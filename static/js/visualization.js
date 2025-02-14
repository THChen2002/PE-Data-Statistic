$(document).ready(function () {
    const lineCtx = $('#lineChart');
    let lineChart;
    const scatterCtx = $('#scatterChart');
    let scatterChart;
    let lineChartData = {};
    let loading_rate = [];

    // 檔案清單點擊事件
    $('#fileList').on('click', 'button', function () {
        $('#fileList button').removeClass('active');
        $(this).addClass('active');
        let filename = $(this).text();
        let unit = $('input[name=unit]:checked').val().toUpperCase();
        getChartData(filename, 'line', unit);
        getChartData(filename, 'scatter', unit);
    });

    // 最後一筆索引改變事件
    $('input[name=d-end]').change(function () {
        let filename = $('#fileList button.active').text();
        let end = parseInt($(this).val());  // 取得使用者輸入的數量
        let unit = $('input[name=unit]:checked').val().toUpperCase();
    
        if (isNaN(end) || end <= 0) {
            alert("請輸入有效的數字");
            return;
        }
        getChartData(filename, 'scatter', unit, end);
        // getChartData(filename, 'line', unit, end);
        // 複製 datasets 並截取前 end 筆數據
        let updatedDatasets = lineChartData[unit].map(dataset => ({
            ...dataset,
            data: dataset.originalData.slice(0, end) // 只取前 end 筆
        }));
    
        // 更新圖表的 datasets 和 labels
        let updatedLabels = updatedDatasets.length > 0 ? updatedDatasets[0].data.map((_, i) => i + 1) : [];
    
        lineChart.data.labels = updatedLabels;
        lineChart.data.datasets = updatedDatasets;
        lineChart.update();
    });

    // 單位轉換事件
    $('input[name=unit]').change(function () {
        let unit = $(this).val().toUpperCase();
        let datasets = lineChartData[unit];
        lineChart.data.datasets = datasets;
        lineChart.options.scales.y.title.text = `Force (${unit})`;
        lineChart.update();
        initParamsBlock();
        show_loading_rate_info(unit);
    });

    /* 計算面積按鈕點擊事件
       這邊是用動態綁定事件的方式，因為新增區塊按鈕是動態新增的，所以要用document方式綁定事件
    */
    $(document).on('click', '.count-impulse-btn', function () {
        let $paramsBlock = $(this).closest('.params-block');
        let $inputs = $paramsBlock.find('input');
        // 找到name開頭為no的radio button，取得選取的值
        let no = $inputs.filter('[name^=no]:checked').val();
        let start = $inputs.filter('[name=start]').val();
        let end = $inputs.filter('[name=end]').val();
        let unit = $('input[name=unit]:checked').val().toUpperCase();
        if (!(start && end)) {
            alert('請輸入正確的數字');
            return;
        }
        $.ajax({
            url: '/api/get_impulse',
            type: 'get',
            data: {
                filename: $('#fileList button.active').text(),
                no: no,
                start: start,
                end: end,
                unit: unit
            },
            success: function (response) {
                if (response.success) {
                    show_impulse_info($paramsBlock, unit, response);
                } else {
                    alert(response.message);
                }
            }
        });
    });

    // 刪除區塊按鈕點擊事件
    $(document).on('click', '.delete-btn', function () {
        let $paramsBlock = $(this).closest('.params-block');
        let datasetId = $paramsBlock.data('dataset-id');
        $paramsBlock.remove();
        // 移除圖表資料
        deleteDataset(datasetId);
    });

    // 新增區塊按鈕點擊事件
    $('#addBlockBtn').click(function () {
        addParamsBlock();
    });

    // 取得圖表資料
    function getChartData(filename, type, unit, end=600) {
        let data = {
            filename: filename,
            type: type,
            end: end
        };
        $.ajax({
            url: '/api/get_chart_data',
            type: 'get',
            data: data,
            success: function (response) {
                if (response.success) {
                    const result = response.result;
                    const data = result.data;
                    const datasets = [];
                    if(type === 'line'){
                        // x軸的標籤(time)
                        const labels = data[Object.keys(data)[0]].map((_, i) => i + 1);
                        const colorMap = {
                            'Fx(N)_1': 'rgb(245, 170, 99)',
                            'Fy(N)_1': 'rgb(242, 128, 153)',
                            'Fz(N)_1': 'rgb(84, 170, 235)',
                            'Fx(BW)_1': 'rgb(245, 170, 99)',
                            'Fy(BW)_1': 'rgb(242, 128, 153)',
                            'Fz(BW)_1': 'rgb(84, 170, 235)',
                            'Fx(N)_2': 'rgb(220, 122, 20)',
                            'Fy(N)_2': 'rgb(250, 54, 99)',
                            'Fz(N)_2': 'rgb(10, 124, 205)',
                            'Fx(BW)_2': 'rgb(220, 122, 20)',
                            'Fy(BW)_2': 'rgb(250, 54, 99)',
                            'Fz(BW)_2': 'rgb(10, 124, 205)'
                        };
                        $.each(data, function (key, value) {
                            if (key in colorMap){
                                let dataset = {
                                    label: key,
                                    data: value,
                                    originalData: value,
                                    fill: false,
                                    borderColor: colorMap[key],
                                    tension: 0.1,
                                    hidden: !['Fx(N)_1', 'Fy(N)_1', 'Fz(N)_1', 'Fx(BW)_1', 'Fy(BW)_1', 'Fz(BW)_1'].includes(key)
                                };
                                datasets.push(dataset);
                            }
                        });

                        // 將資料分成N和BW兩個部分存入全域變數
                        lineChartData = {
                            'N': datasets.filter(dataset => ['Fx(N)_1', 'Fy(N)_1', 'Fz(N)_1', 'Fx(N)_2', 'Fy(N)_2', 'Fz(N)_2'].includes(dataset.label)),
                            'BW': datasets.filter(dataset => ['Fx(BW)_1', 'Fy(BW)_1', 'Fz(BW)_1', 'Fx(BW)_2', 'Fy(BW)_2', 'Fz(BW)_2'].includes(dataset.label))
                        }
                        loading_rate = result.loading_rate;

                        initLineChart(lineChartData[unit], labels);
                        show_loading_rate_info(unit);
                        initParamsBlock();
                    } else if(type === 'scatter'){
                        const colorMap = {
                            'COP(x)(m)_1': 'red',
                            // 'COP(y)(m)_1': 'red',
                            'COP(x)(m)_2': 'blue',
                            // 'COP(y)(m)_2': 'blue',
                            'ellipse1': 'rgba(54, 162, 235, 0.3)',
                            'ellipse2': 'rgba(255, 99, 132, 0.3)',
                        }
                        $.each(data, function (key, value) {
                            const index = key.split('_')[1];
                            if (key in colorMap){
                                let dataset = {
                                    label: `測力板${index}`,
                                    data: value.map((_, i) => ({ x: data[`COP(x)(m)_${index}`][i], y: data[`COP(y)(m)_${index}`][i] })),
                                    showLine: false,
                                    hidden: !['COP(x)(m)_1'].includes(key),
                                };
                                datasets.push(dataset);
                            }
                        });
                        ellipseData = {};
                        $.each(result.ellipse, function(index, value){
                            ellipseData[`ellipse${index+1}`] = {
                                type: 'ellipse',
                                xMin: value.xMin,
                                xMax: value.xMax,
                                yMin: value.yMin,
                                yMax: value.yMax,
                                rotation: value.rotation,   
                                backgroundColor: colorMap[`ellipse${index+1}`],
                                display: index+1 === 1
                            };
                        });
                        
                        initScatterChart(datasets, ellipseData);
                        show_stability_info(result.stability_index, result.ellipse);
                    }
                    $('.chart-block').show();
                } else {
                    alert(response.message || '資料讀取失敗');
                }
            },
            error: function (error) {
                alert('圖表初始化錯誤，請洽系統管理員');
            }
        });
    };

    // 初始化LineChart
    function initLineChart(datasets, labels) {
        if (lineChart) {
            lineChart.destroy();
        }
        lineChart = new Chart(lineCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Time (s)',
                            color: 'red',
                        },
                        ticks: {
                            callback: function (val, index) {
                                return index_to_second(val);
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'Force (N)',
                            color: 'red',
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            title: function (context) {
                                return `${context[0].dataIndex + 1}\nTime: ${index_to_second(context[0].dataIndex)}(s)`;
                            },
                            label: function (context) {
                                return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
                            }
                        }
                    }
                }
            }
        });
    };

    // 初始化ScatterChart
    function initScatterChart(datasets, ellipse) {
        if (scatterChart) {
            scatterChart.destroy();
        }
        scatterChart = new Chart(scatterCtx, {
            type: 'scatter',
            data: {
                datasets: datasets
            },
            options: {
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'COP(x)(m)',
                            color: 'red',
                        },
                        ticks: {
                            callback: function (val, index) {
                                return Math.round(val * 1000) / 1000;
                            }
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'COP(y)(m)',
                            color: 'red',
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    legend: {
                        onClick: (e, legendItem, legend) => {
                            const chart = legend.chart;
                            const index = legendItem.datasetIndex + 1;
                            const annotation = chart.options.plugins.annotation.annotations[`ellipse${index}`];
        
                            annotation.display = !annotation.display;
                            
                            // Call the default onClick handler
                            Chart.defaults.plugins.legend.onClick.call(chart, e, legendItem, legend);
                            chart.update();
                        }
                    },
                    annotation: {
                        annotations: ellipse
                    }
                }
            }
        });
    };

    // 將index轉換成秒數(1200筆=1秒)
    function index_to_second(val){
        return Math.round((val / 1200) * 1000) / 1000;
    }
    
    // 初始化ParamsBlock區塊
    function initParamsBlock() {
        // 只留下第一個區塊
        $('.params-block').not(':first').remove();
        addParamsBlock();
        $('#addBlockBtn').show();
    }
    
    // 新增ParamsBlock區塊(用display:none的當模板，複製後再顯示)
    function addParamsBlock() {
        let $newBlock = $('.params-block').first().clone();
        let newDatasetId = getNewDatasetId();
        $newBlock.find('.phase-title').text('Phase ' + newDatasetId);
        // 將radio button的name改成no-datasetId
        $newBlock.find('input[type=radio]').attr('name', `no-${newDatasetId}`);
        $newBlock.data('dataset-id', newDatasetId);
        $newBlock.addClass('active');
        $newBlock.show();
        $newBlock.insertBefore($('#addBlockBtn').parent());
    }

    // 取得新的dataset id(目前最後一個的dataset id + 1)
    function getNewDatasetId() {
        let currentIds = $('.params-block').last().data('dataset-id');
        return currentIds + 1;
    }

    // 刪除linechart的dataset
    function deleteDataset(datasetId) {
        lineChart.data.datasets = lineChart.data.datasets.filter(dataset => dataset.id !== datasetId);
        lineChart.update();
    }

    function show_impulse_info($paramsBlock, unit, response){
        let datasetId = $paramsBlock.data('dataset-id');
        // 先刪除舊的 dataset
        deleteDataset(datasetId);

        $paramsBlock.find('.impulse-text').text(`衝量: ${response.area} ${unit}∙s`);
        // 更新圖表
        lineChart.data.datasets.push({
            label: 'Phase_' + datasetId,
            id: datasetId,
            data: response.data,
            fill: true,
            backgroundColor: 'rgba(255, 99, 132, 0.3)'
        });
        // 如果id是datasetId，則不顯示tooltip
        lineChart.options.plugins.tooltip.callbacks.label = function (context) {
            if (context.dataset.id === datasetId) {
                return `${context.dataset.label}: ${response.area}`;
            }
            return `${context.dataset.label}: ${context.raw.toFixed(2)}`;
        };
        lineChart.update();
    }

    // 顯示loading rate資訊
    function show_loading_rate_info(unit) {
        const $loadingRateBlock = $('#loading-rate-block');
        const $block = $loadingRateBlock.children().first();
        const $cloneBlock = $block.clone();
        $loadingRateBlock.empty();
        $.each(loading_rate, function(index, value) {
            const data = value[unit];
            let $newBlock = $cloneBlock.clone();
            $newBlock.find('.phase-title').text(`測力板 ${index+1}`);
            $newBlock.find('.max').text(`${data.max.value} (${data.max.unit})`);
            $newBlock.find('.time').text(`${data.time.value} (${data.time.unit})`);
            $newBlock.find('.rate').text(`${data.rate.value} (${data.rate.unit})`);
            $loadingRateBlock.append($newBlock);
        });
    }

    // 顯示穩定指數資訊
    function show_stability_info(stability_index, ellipse){
        let $stability = $('#stability');
        let $block = $stability.find('.stability-block').first();
        let $cloneBlock = $block.clone();
        // 除了第一個cnavas區塊，其他都刪除
        $stability.children('div:not(:first)').remove();
        $.each(stability_index, function(index, stability){
            let $newBlock = $cloneBlock.clone();
            $newBlock.find('.no-title').text(`測力板 ${index+1}`);
            $.each(stability, function(key, value){
                $newBlock.find(`.${key}`).text(value);
            });
            $newBlock.find('.COP-area').text(ellipse[index].area);
            $stability.append($newBlock);
        });
    }
});