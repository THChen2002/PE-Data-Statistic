$(document).ready(function () {
    const lineCtx = $('#lineChart');
    let lineChart;
    const scatterCtx = $('#scatterChart');
    let scatterChart;
    let chartData = {};
    let loading_rate = {};

    // 檔案清單點擊事件
    $('#fileList').on('click', 'button', function () {
        $('#fileList button').removeClass('active');
        $(this).addClass('active');
        let filename = $(this).text();
        let unit = $('input[name=unit]:checked').val().toUpperCase();
        getChartData(filename, 'line', unit);
        getChartData(filename, 'scatter', unit);
    });

    // 單位轉換事件
    $('input[name=unit]').change(function () {
        let unit = $(this).val().toUpperCase();
        let datasets = chartData[unit];
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
        let start = $inputs.eq(0).val();
        let end = $inputs.eq(1).val();
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
    function getChartData(filename, type, unit) {
        let data = {
            filename: filename,
            type: type
        };
        $.ajax({
            url: '/api/get_chart_data',
            type: 'get',
            data: data,
            success: function (response) {
                if (response.success) {
                    const result = response.result;
                    const data = result.data;
                    if(type === 'line'){
                        // x軸的標籤(time)
                        const labels = data[Object.keys(data)[0]].map((_, i) => i + 1);
                        const datasets = [];
                        const colorMap = {
                            'Fx(N)': 'rgb(255, 159, 64)',
                            'Fy(N)': 'rgb(255, 99, 132)',
                            'Fz(N)': 'rgb(54, 162, 235)',
                            'Fx(BW)': 'rgb(255, 159, 64)',
                            'Fy(BW)': 'rgb(255, 99, 132)',
                            'Fz(BW)': 'rgb(54, 162, 235)'
                        };
                        $.each(data, function (key, value) {
                            if (key in colorMap){
                                let dataset = {
                                    label: key,
                                    data: value,
                                    fill: false,
                                    borderColor: colorMap[key],
                                    tension: 0.1
                                };
                                datasets.push(dataset);
                            }
                        });

                        // 將資料分成N和BW兩個部分存入全域變數
                        chartData = {
                            'N': datasets.filter(dataset => ['Fx(N)', 'Fy(N)', 'Fz(N)'].includes(dataset.label)),
                            'BW': datasets.filter(dataset => ['Fx(BW)', 'Fy(BW)', 'Fz(BW)'].includes(dataset.label))
                        }
                        loading_rate = result.loading_rate;

                        initLineChart(chartData[unit], labels);
                        show_loading_rate_info(unit);
                        initParamsBlock();
                    } else if(type === 'scatter'){
                        initScatterChart(data, result.ellipse);
                        show_stability_info(result.stability_index, result.ellipse.area);
                    }
                    $('.chart-block').show();
                }
            },
            error: function (error) {
                alert('發生錯誤，請洽系統管理員');
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
    function initScatterChart(data, ellipse) {
        if (scatterChart) {
            scatterChart.destroy();
        }
        scatterChart = new Chart(scatterCtx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'COP(x) vs COP(y)',
                        data: data['COP(x)(m)'].map((_, i) => ({ x: data['COP(x)(m)'][i], y: data['COP(y)(m)'][i] })),
                        backgroundColor: 'red',
                        borderColor: 'red',
                        showLine: false,
                    },
                ]
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
                    annotation: {
                        annotations: {
                            ellipse1: {
                                type: 'ellipse',
                                xMin: ellipse.xMin,
                                xMax: ellipse.xMax,
                                yMin: ellipse.yMin,
                                yMax: ellipse.yMax,
                                rotation: ellipse.rotation,   
                                backgroundColor: 'rgba(255, 99, 132, 0.25)'
                            }
                        }
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
        $newBlock.data('dataset-id', newDatasetId);
        $newBlock.addClass('active');
        $newBlock.show();
        $newBlock.insertBefore($('#addBlockBtn'));
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

        $paramsBlock.find('.impulse-text').text(`衝量: ${response.area} ${unit}/s`);
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
    function show_loading_rate_info(unit){
        $.each(loading_rate[unit], function(key, value){
            $(`#${key}`).text(`${value.value}(${value.unit})`);
        });
    }

    // 顯示穩定指數資訊
    function show_stability_info(info, area){
        $.each(info, function(key, value){
            $(`#${key}`).text(value);
        });
        $('#COP-area').text(area);
    }
});