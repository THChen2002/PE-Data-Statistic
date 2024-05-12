from flask import Flask, request, render_template, send_file, jsonify
from werkzeug.utils import secure_filename
import os
import zipfile
import numpy as np
import pandas as pd

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
    items = request.form.getlist('items')
    file_names = []
    for file in files:
        if file and allowed_file(file.filename):
            file_name = secure_filename(file.filename)
            file_names.append(file_name.replace('.txt', '.xlsx'))
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)
            file.save(file_path)
            txt_to_excel(file_path, items)
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
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)
    df = pd.read_excel(file_path)[:600]
    # 把每個column的資料轉成list
    data = {col: df[col].tolist() for col in df.columns}
    return jsonify({'success': True, 'data': data})

@app.route('/api/get_area', methods=['GET'])
def count_area():
    """計算面積"""
    file_name = request.args.get('filename')
    start_index = request.args.get('start')
    end_index = request.args.get('end')
    if file_name and start_index and end_index:
        index = [int(start_index), int(end_index)]
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], file_name)
        df = pd.read_excel(file_path)[:600]
        times = np.array(df.index/1200)
        Fz_values = np.array(df['Fz'])
        area = np.trapz(Fz_values[index[0]:index[1]+1], times[index[0]:index[1]+1])
        return jsonify({'success': True, 'area': round(area, 3)})
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

def txt_to_excel(file_path, items):
    """將txt檔轉成excel檔，根據items選擇要計算的資料"""
    header=['Fx','Fy','Fz','Mx','My','Mz']
    original_df = pd.read_table(file_path, sep=',', names=header)
    if 'COP' in items:
        original_df = count_COP(original_df)
    original_df.to_excel(file_path.replace('.txt', '.xlsx'), index=False)
    remove_fz_less_than_10(original_df).to_excel(file_path.replace('.txt', '_processing.xlsx'), index=False)

def count_COP(df):
    """計算COP(x)和COP(y)"""
    df['COP(x)'] = -(df['My'] / df['Fz'])
    df['COP(y)'] = df['Mx'] / df['Fz']
    return df

def remove_fz_less_than_10(df):
    """移除前後Fz小於10的資料"""
    fz_more_than_10_index = df[df['Fz'] >= 10]
    # 找出第一筆Fz大於10的index
    start = fz_more_than_10_index.index[0]
    # 找出最後一筆Fz大於10的index
    end = fz_more_than_10_index.index[-1]
    return df[start-1:end+1]

if __name__ == '__main__':
    app.run()