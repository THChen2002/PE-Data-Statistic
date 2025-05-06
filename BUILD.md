# 打包執行檔

## 安裝套件

在開始之前，請先安裝 PyInstaller：

```bash
pip install pyinstaller
```

## Windows/MacOS

> 注意：PyInstaller 版本需為 5.0 或以上。以下指令會根據目前啟動的虛擬環境進行打包。若在 macOS 上執行，請先指定啟動的 port，例如：`app.run(port=5001)`。

使用以下指令進行打包：

```bash
pyinstaller --noconfirm --onefile --debug=all --console --name=app --add-data=./static:static --add-data=./templates:templates app.py
```
