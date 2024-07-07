from flask import Flask, request, render_template, send_file, jsonify
from werkzeug.utils import secure_filename
import os
import zipfile
import numpy as np
import pandas as pd
# from sklearn.covariance import EllipticEnvelope

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'txt', 'csv'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/visualization', methods=['GET'])
def visualization():
    files = get_file_list()
    return render_template('visualization.html', **locals())

@app.route('/upload', methods=['POST'])
def upload_file():
    files = request.files.getlist('files')
    items = request.form.get('items').split(',')
    weight = request.form.get('weight')
    file_names = []
    for file in files:
        if file and allowed_file(file.filename):
            file_name = secure_filename(file.filename)
            file_names.append(file_name.replace('.txt', '.xlsx'))
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)
            file.save(file_path)
            txt_to_excel(file_path, items, weight)
    return jsonify({'message': '檔案上傳成功', 'filename': ','.join(file_names)})
        

@app.route('/download/<name>', methods=['GET', 'POST'])
def download_file(name):
    files = name.split(',')
    zip_file_name = 'download.zip'
    zip_file_path = os.path.join(app.config['UPLOAD_FOLDER'], zip_file_name)
    with zipfile.ZipFile(zip_file_path, 'w') as zipf:
        for file in files:
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file)
            zipf.write(file_path, arcname=os.path.basename(file_path))
            processing_file_path = file_path.replace('.xlsx', '_processing.xlsx')
            zipf.write(processing_file_path, arcname=os.path.basename(processing_file_path))
    return send_file(zip_file_path, as_attachment=True)

@app.route('/api/get_chart_data', methods=['GET'])
def get_chart_data():
    file_name = request.args.get('filename')
    chart_type = request.args.get('type')
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)
    df = pd.read_excel(file_path)[:600]
    # 把每個column的資料轉成list
    data = {col: df[col].tolist() for col in df.columns}
    result = {}
    if chart_type == 'line':
        result['data'] = data
        result['loading_rate'] = {
            'N': count_loading_rate(np.array(df['Fz(N)']), 'N'),
            'BW': count_loading_rate(np.array(df['Fz(BW)']), 'BW')
        }
    elif chart_type == 'scatter':
        ellipse_data = get_ellipse_data(df)
        result['data'] = {col: data[col] for col in ['COP(x)(m)', 'COP(y)(m)']}
        result['stability_index'] = count_stability_index(df)
        result['ellipse'] = ellipse_data
    else:
        result['data'] = data

    return jsonify({'success': True, 'result': result})

@app.route('/api/get_impulse', methods=['GET'])
def count_impulse():
    """計算Fz區間面積(衝量)"""
    file_name = request.args.get('filename')
    start_index = request.args.get('start')
    end_index = request.args.get('end')
    unit = request.args.get('unit')
    if file_name and start_index and end_index:
        # index由小到大排序
        index = [int(end_index)-1, int(start_index)-1]
        index.sort()
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)
        df = pd.read_excel(file_path)[:600]
        times = np.array(df.index/1200)
        Fz_values = np.array(df['Fz(N)']) if unit == 'N' else np.array(df['Fz(BW)'])
        area = np.trapz(Fz_values[index[0]:index[1]+1], times[index[0]:index[1]+1])

        # 把索引區間以外的資料設為None => 用於前端顯示另一個dataset
        cleaned_data = [None] * len(Fz_values)
        cleaned_data[index[0]:index[1] + 1] = Fz_values[index[0]:index[1] + 1].tolist()
        return jsonify({'success': True, 'area': round(area, 3), 'data': cleaned_data})
    else:
        return jsonify({'success': False, 'message': '請選擇檔案和區間索引'})

def allowed_file(filename):
    """檢查檔案格式"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def get_file_list():
    """Returns
    file_list: 已上傳處理過的檔案列表
    """
    file_list = os.listdir(app.config['UPLOAD_FOLDER'])
    file_list = [file for file in file_list if file.endswith('processing.xlsx')]
    return file_list

def txt_to_excel(file_path, items, weight):
    """將txt檔轉成excel檔，根據items選擇要計算的資料"""
    header=['Fx(N)','Fy(N)','Fz(N)','Mx(N-m)','My(N-m)','Mz(N-m)']
    original_df = pd.read_table(file_path, sep=',', names=header)
    # 如果有輸入體重，將F/(N*weight)
    if weight:
        weight = float(weight)
        N = 9.8
        original_df['Fx(BW)'] = original_df['Fx(N)'] / (N * weight)
        original_df['Fy(BW)'] = original_df['Fy(N)'] / (N * weight)
        original_df['Fz(BW)'] = original_df['Fz(N)'] / (N * weight)
    if 'COP' in items:
        original_df = count_COP(original_df)
    original_df.to_excel(file_path.replace('.txt', '.xlsx'), index=False)
    remove_fz_less_than_10(original_df).to_excel(file_path.replace('.txt', '_processing.xlsx'), index=False)

def count_COP(df):
    """
    計算COP
    COP(x) = -My/Fz
    COP(y) = Mx/Fz
    """
    df['COP(x)(m)'] = -(df['My(N-m)'] / df['Fz(N)'])
    df['COP(y)(m)'] = df['Mx(N-m)'] / df['Fz(N)']
    return df

def count_loading_rate(Fz_values, unit):
    """計算Fz從10N到max的斜率"""
    max_index = np.argmax(Fz_values)
    max_value = Fz_values[max_index]
    rate = (max_value - Fz_values[0]) / (max_index*(1/1200))
    result = {
        'max': {
            'value': round(max_value, 3),
            'unit': unit
        },
        'time': {
            'value': round(max_index*(1/1200), 3),
            'unit': 's'
        },
        'rate': {
            'value': round(rate, 3),
            'unit': f'{unit}/s'
        }
    }
    return result

# TODO: 計算方式待確認
def count_stability_index(df):
    """
    計算平衡指數
    COP VEL-total(mm/s): sqrt(∑(COPx(n+1) - COPx(n))**2 + ∑(COPy(n+1) - COPy(n))**2)/n
    COP VEL-AP(mm/s): sqrt(∑(COPx)**2)/n
    COP VEL-ML(mm/s): sqrt(∑(COPy)**2)/n
    COP AMP-AP(mm): max(COPx) - min(COPx)
    COP AMP-ML(mm): max(COPy) - min(COPy)
    APSI: sqrt(∑(0-GRFxi)**2/n)/w
    MLSI: sqrt(∑(0-GRFyi)**2/n)/w
    VSI: sqrt(∑(0-GRFzi)**2/n)/w
    DPSI: sqrt([∑(0-GRFxi)**2 + ∑(0-GRFyi)**2 + ∑(w-GRFzi)**2] / n) / w
    """
    N = 9.8
    result = {
        'VEL-total': round(np.sqrt(np.sum((df['COP(x)(m)'].diff())**2 + (df['COP(y)(m)'].diff())**2) / (len(df) / 1200)) * 1000, 2),
        'VEL-AP': round(np.sqrt(np.sum(df['COP(x)(m)'].diff()**2) / (len(df) / 1200)) * 1000, 2),
        'VEL-ML': round(np.sqrt(np.sum(df['COP(y)(m)'].diff()**2) / (len(df) / 1200)) * 1000, 2),
        'AMP-AP': round((max(df['COP(x)(m)']) - min(df['COP(x)(m)'])) * 1000, 2),
        'AMP-ML': round((max(df['COP(y)(m)']) - min(df['COP(y)(m)'])) * 1000, 2),
        'APSI': round(np.sqrt(np.sum((0 - df['Fx(N)'])**2) / len(df)) / N, 2),
        'MLSI': round(np.sqrt(np.sum((0 - df['Fy(N)'])**2) / len(df)) / N, 2),
        'VSI': round(np.sqrt(np.sum((0 - df['Fz(N)'])**2) / len(df)) / N, 2),
        'DPSI': round(np.sqrt(np.sum((0 - df['Fx(N)'])**2 + (0 - df['Fy(N)'])**2 + (N - df['Fz(N)'])**2) / len(df)) / N, 2)
    }
    return result

# TODO: 去尾資料方式待確認
def remove_fz_less_than_10(df):
    """移除頭尾資料
    頭: 第一筆Fz大於10N
    尾: 等於體重
    """
    fz_more_than_10_index = df[df['Fz(N)'] >= 10]
    # 找出第一筆Fz大於10的index
    start = fz_more_than_10_index.index[0]
    # 找出最後一筆Fz大於10的index
    end = fz_more_than_10_index.index[-1]
    return df[start-1:end+1]

# TODO: 計算方式待確認
def get_ellipse_data(df):
    """
    計算COP橢圓
    """
    def remove_outliers_z_score(data, threshold=3):
        """
        使用Z-分數法剔除離群值
        """
        z_scores = np.abs((data - np.mean(data, axis=0)) / np.std(data, axis=0))
        return data[(z_scores < threshold).all(axis=1)]

    # 提取 COP(x) 和 COP(y) 列
    cop_x = df['COP(x)(m)'].values
    cop_y = df['COP(y)(m)'].values

    # 確保數據範圍正常
    cop_x = cop_x[np.isfinite(cop_x)]
    cop_y = cop_y[np.isfinite(cop_y)]
    data_points = np.column_stack((cop_x, cop_y))

    # 方法一: 使用 Z-分數法剔除離群值
    filtered_data_points = remove_outliers_z_score(data_points)

    # 方法二: 使用 EllipticEnvelope 剔除離群值
    # envelope = EllipticEnvelope(contamination=0.2)
    # envelope.fit(data_points)
    # inliers = envelope.predict(data_points) == 1
    # filtered_data_points = data_points[inliers]

    # 計算橢圓參數
    cov = np.cov(filtered_data_points, rowvar=False)
    eigenvalues, eigenvectors = np.linalg.eigh(cov)
    order = eigenvalues.argsort()[::-1]
    eigenvalues = eigenvalues[order]
    eigenvectors = eigenvectors[:, order]
    angle_radians = np.arctan2(*eigenvectors[:, 0][::-1])
    angle_degrees = -1 * np.degrees(angle_radians) # 因為chart.js的rotation是順時針為正
    width, height = 2 * np.sqrt(eigenvalues) * 3  # 3 標準差

    # 計算橢圓面積
    area = np.pi * width * height / 4

    # 輸出橢圓參數和面積
    ellipse_params = {
        'xMin': np.min(filtered_data_points[:, 0]),
        'xMax': np.max(filtered_data_points[:, 0]),
        'yMin': np.min(filtered_data_points[:, 1]),
        'yMax': np.max(filtered_data_points[:, 1]),
        'rotation': angle_degrees,
        # m^2轉mm^2
        'area': round(area * pow(1000, 2), 2)
    }
    return ellipse_params

if __name__ == '__main__':
    app.run()