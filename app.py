from flask import Flask, request, render_template, send_file, jsonify
from werkzeug.utils import secure_filename
import os
import zipfile
import numpy as np
import pandas as pd
import re
from collections import defaultdict
import os, sys

if getattr(sys, 'frozen', False):
    BASE_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))

UPLOAD_FOLDER = os.path.join(BASE_DIR, 'uploads')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

ALLOWED_EXTENSIONS = {'txt', 'csv'}

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

@app.route('/', methods=['GET'])
def index():
    return render_template('index.html')

@app.route('/visualization', methods=['GET'])
def visualization():
    files = sorted(get_file_list())
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
            file_names.append(file_name.split('.')[0])
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)
            file.save(file_path)
            txt_to_excel(file_path, items, weight)
    return jsonify({'message': '檔案上傳成功', 'filename': ','.join(file_names)})
        

@app.route('/download/<name>', methods=['GET'])
def download_file(name):
    files = name.split(',')
    zip_file_name = 'download.zip'
    zip_file_path = os.path.join(app.config['UPLOAD_FOLDER'], zip_file_name)
    with zipfile.ZipFile(zip_file_path, 'w') as zipf:
        for file in files:
            # 一個檔案可能有兩個測力板（12欄）或只有一個測力板（6欄）
            for i in range(1, 3):
                file_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file}_{i}.xlsx')
                processing_file_path = file_path.replace('.xlsx', '_processing.xlsx')
                # 只添加存在的檔案
                if os.path.exists(file_path):
                    zipf.write(file_path, arcname=os.path.basename(file_path))
                if os.path.exists(processing_file_path):
                    zipf.write(processing_file_path, arcname=os.path.basename(processing_file_path))
    return send_file(zip_file_path, as_attachment=True)

@app.route('/api/get_chart_data', methods=['GET'])
def get_chart_data():
    file_name = request.args.get('filename')
    chart_type = request.args.get('type')
    result = defaultdict(dict)
    result['loading_rate'] = []
    result['stability_index'] = []
    result['ellipse'] = []
    result['plate_count'] = 0  # 測力板數量
    
    # 動態檢測測力板數量
    i = 1
    while i <= 10:
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_name}_{i}_processing.xlsx')
        if not os.path.exists(file_path):
            break
        df = pd.read_excel(file_path)
        # 把每個column的資料轉成list
        data = {col: df[col].tolist() for col in df.columns}
        # 欄位名字後面加上_{i}，用於區分測力板的資料
        data = {f'{col}_{i}': data[col] for col in data}

        if chart_type == 'line':
            result['data'].update(data)
            result['loading_rate'].append({
                'N': count_loading_rate(np.array(df['Fz(N)']), 'N'),
                'BW': count_loading_rate(np.array(df['Fz(BW)']), 'BW')
            })
        elif chart_type == 'scatter':
            ellipse_data = get_ellipse_data(df)
            result['data'].update({col: data[col] for col in [f'COP(x)(m)_{i}', f'COP(y)(m)_{i}']})
            result['stability_index'].append(count_stability_index(df))
            result['ellipse'].append(ellipse_data)
        else:
            result['data'].update(data)
        
        result['plate_count'] = i
        i += 1

    return jsonify({'success': True, 'result': result})

@app.route('/api/get_impulse', methods=['GET'])
def count_impulse():
    """計算Fz區間面積(衝量)"""
    file_name = request.args.get('filename')
    no = request.args.get('no')
    start_index = request.args.get('start')
    end_index = request.args.get('end')
    unit = request.args.get('unit')
    if file_name and start_index and end_index and no:
        # index由小到大排序
        index = [int(end_index)-1, int(start_index)-1]
        index.sort()
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], f'{file_name}_{no}_processing.xlsx')
        if not os.path.exists(file_path):
            return jsonify({'success': False, 'message': f'測力板 {no} 的檔案不存在'})
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

    # 使用正則表達式移除尾部的 '_數字_processing.xlsx'，只保留基礎檔案名稱
    cleaned_names = set(re.sub(r'_\d+_processing\.xlsx$', '', file) for file in file_list)

    # 回傳去重後的檔案列表
    return list(cleaned_names)

def txt_to_excel(file_path, items, weight):
    """將txt檔轉成excel檔，根據items選擇要計算的資料"""
    # 如果有輸入體重，將F/(N*weight)
    if weight:
        weight = float(weight)
        N = 9.8
        # 讀取原始txt檔，不指定header，將內容視為純資料
        original_df = pd.read_table(file_path, sep=',')

        # 為拆分後的資料賦予欄位名稱
        headers = ['Fx(N)', 'Fy(N)', 'Fz(N)', 'Mx(N-m)', 'My(N-m)', 'Mz(N-m)']
        
        start, end = get_fz_keep_index(original_df)
        # 拆分資料為兩部分：前6欄和後6欄
        num_cols = original_df.shape[1]
        df1 = original_df.iloc[:, :6]
        dataframes = [df1]
        
        # 如果有12欄，才處理第二塊測力板
        if num_cols >= 12:
            df2 = original_df.iloc[:, 6:12]
            dataframes.append(df2)
        
        for i, df in enumerate(dataframes):
            df.columns = headers
            df.loc[:, ['Fx(BW)']] = df['Fx(N)'] / (N * weight)
            df.loc[:, ['Fy(BW)']] = df['Fy(N)'] / (N * weight)
            df.loc[:, ['Fz(BW)']] = df['Fz(N)'] / (N * weight)

            if'COP' in items:
                df = count_COP(df)

            # 儲存未去頭尾資料的檔案
            df.to_excel(file_path.replace('.txt', f'_{i+1}.xlsx'), index=False)
            # 儲存去頭尾資料的檔案
            df[start:end].to_excel(file_path.replace('.txt', f'_{i+1}_processing.xlsx'), index=False)

def count_COP(df):
    """
    計算COP
    COP(x) = -My/Fz
    COP(y) = Mx/Fz
    """
    # 確保Fz不為0，避免除以0
    df.loc[:, 'COP(x)(m)'] = np.where(
        df['Fz(N)'] != 0,
        -(df['My(N-m)'] / df['Fz(N)']),
        0
    )

    df.loc[:, 'COP(y)(m)'] = np.where(
        df['Fz(N)'] != 0,
        df['Mx(N-m)'] / df['Fz(N)'],
        0
    )
    return df

def count_loading_rate(Fz_values, unit):
    """計算Fz從10N到max的斜率"""
    max_index = np.argmax(Fz_values)
    max_value = Fz_values[max_index]
    # 取Fz第2筆資料的值(因為第2筆資料才>10N)
    rate = (max_value - Fz_values[1]) / (max_index*(1/1200))
    result = {
        'index': int(max_index), # np.int64轉成int
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

def count_stability_index(df):
    """
    計算平衡指數
    COP VEL-total(mm/s): ∑sqrt((COPx(n+1) - COPx(n))**2 + (COPy(n+1) - COPy(n))**2)/n
    COP VEL-AP(mm/s): ∑sqrt((COPx)**2)/n
    COP VEL-ML(mm/s): ∑sqrt((COPy)**2)/n
    COP AMP-AP(mm): max(COPx) - min(COPx)
    COP AMP-ML(mm): max(COPy) - min(COPy)
    APSI: sqrt(∑(0-GRFxi)**2/n)/w
    MLSI: sqrt(∑(0-GRFyi)**2/n)/w
    VSI: sqrt(∑(w-GRFzi)**2/n)/w
    DPSI: sqrt([∑(0-GRFxi)**2 + ∑(0-GRFyi)**2 + ∑(w-GRFzi)**2] / n) / w
    """
    N = 9.8
    weight = df['Fz(N)'][0] / df['Fz(BW)'][0]
    result = {
        'VEL-total': round(np.sum(np.sqrt((df['COP(x)(m)'].diff())**2 + (df['COP(y)(m)'].diff())**2)) / (len(df) / 1200) * 1000, 2),
        'VEL-AP': round(np.sum(np.sqrt(df['COP(x)(m)'].diff()**2)) / (len(df) / 1200) * 1000, 2),
        'VEL-ML': round(np.sum(np.sqrt(df['COP(y)(m)'].diff()**2)) / (len(df) / 1200) * 1000, 2),
        'AMP-AP': round((max(df['COP(x)(m)']) - min(df['COP(x)(m)'])) * 1000, 2),
        'AMP-ML': round((max(df['COP(y)(m)']) - min(df['COP(y)(m)'])) * 1000, 2),
        'APSI': round(np.sqrt(np.sum((0 - df['Fx(N)'])**2) / len(df)) / weight, 2),
        'MLSI': round(np.sqrt(np.sum((0 - df['Fy(N)'])**2) / len(df)) / weight, 2),
        'VSI': round(np.sqrt(np.sum((weight - df['Fz(N)'])**2) / len(df)) / weight, 2),
        'DPSI': round(np.sqrt(np.sum((0 - df['Fx(N)'])**2) + np.sum((0 - df['Fy(N)'])**2) + np.sum((weight - df['Fz(N)'])**2) / len(df)) / weight, 2)
    }
    return result

# TODO: 去尾資料方式待確認
def get_fz_keep_index(df):
    """Return
    Tuple: (start, end)
    移除頭尾資料
    頭: 第一筆Fz大於10N
    尾: 等於體重
    """
    fz_more_than_10_index = df[df.iloc[:, 2] >= 10]
    # 找出第一筆Fz大於10的index(如果start大於0就抓前面一筆)
    start = fz_more_than_10_index.index[0]
    start = start - 1 if start > 0 else 0
    # 找出最後一筆Fz大於10的index
    end = fz_more_than_10_index.index[-1]

    # window = 50
    # threshold = 0.1
    # # 計算滾動平均以平滑資料並幫助識別穩定點
    # rolling_mean = df['Fz(N)'][start:end].rolling(window=window).mean()
    # # 找到力開始穩定的點，即滾動平均值的變化變得最小的地方
    # steady_state_index = (rolling_mean.diff().abs() < threshold).idxmax()

    # # 確保穩定狀態不在範圍之外
    # end = min(steady_state_index, end)
    return start, end+1

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

    # 使用 Z-分數法剔除離群值
    filtered_data_points = remove_outliers_z_score(data_points)

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
