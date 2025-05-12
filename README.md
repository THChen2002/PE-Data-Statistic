## 使用說明

請到 [Release](https://github.com/THChen2002/PE-Data-Statistic/releases) 下載 `app.exe`(Windows) / `app`(MacOS) ，並在同一層新增一個名為 `uploads` 的空資料夾，然後執行 `app.exe` / `app`，並在瀏覽器輸入`127.0.0.1:5000`(Windows) / `127.0.0.1:5001`(MacOS)。

資料夾結構如下：

```
PE-Data-Statistic/
├── app.exe or app
└── uploads/
```

## COP 計算公式

- **COP X 分量**：  
  $COP_x = \frac{-M_y}{F_z}$  

- **COP Y 分量**：  
  $COP_y = \frac{M_x}{F_z}$  

## 靜態平衡

### COP 速度計算公式

- **總速度 (COP VEL-total, mm/s)**：  
  $COP_{\text{VEL-total}} = \sum \frac{\sqrt{(COP_x(n+1) - COP_x(n))^2 + (COP_y(n+1) - COP_y(n))^2}}{n}$  

- **前後方向速度 (COP VEL-AP, mm/s)**：  
  $COP_{\text{VEL-AP}} = \sum \frac{\sqrt{(COP_x)^2}}{n}$  

- **左右方向速度 (COP VEL-ML, mm/s)**：  
  $COP_{\text{VEL-ML}} = \sum \frac{\sqrt{(COP_y)^2}}{n}$  

### COP 振幅計算公式

- **前後方向振幅 (COP AMP-AP, mm)**：  
  $COP_{\text{AMP-AP}} = \max(COP_x) - \min(COP_x)$  

- **左右方向振幅 (COP AMP-ML, mm)**：  
  $COP_{\text{AMP-ML}} = \max(COP_y) - \min(COP_y)$  

## 動態平衡

- **前後穩定性指數 (APSI)**：  
  $APSI = \frac{\sqrt{\sum(0 - GRF_{xi})^2 / n}}{w}$  

- **左右穩定性指數 (MLSI)**：  
  $MLSI = \frac{\sqrt{\sum(0 - GRF_{yi})^2 / n}}{w}$  

- **垂直穩定性指數 (VSI)**：  
  $VSI = \frac{\sqrt{\sum(w - GRF_{zi})^2 / n}}{w}$  

- **動態穩定性指數 (DPSI)**：  
  $DPSI = \frac{\sqrt{\left[ \sum(0 - GRF_{xi})^2 + \sum(0 - GRF_{yi})^2 + \sum(w - GRF_{zi})^2 \right] / n}}{w}$

