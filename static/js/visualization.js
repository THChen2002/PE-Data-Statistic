$(document).ready(function () {
    // 檔案清單點擊事件
    $('#FileList').on('click', 'button', function () {
        $('#FileList button').removeClass('active');
        $(this).addClass('active');
        var filename = $(this).text();
        getChartData(filename);
    });

    /* 計算面積按鈕點擊事件
       這邊是用動態綁定事件的方式，因為新增區塊按鈕是動態新增的，所以要用document方式綁定事件
    */
    $(document).on('click', '.count-area-btn', function () {
        var $paramsBlock = $(this).closest('.params-block');
        var $inputs = $paramsBlock.find('input');
        var start = $inputs.eq(0).val();
        var end = $inputs.eq(1).val();
        if (start == '' || end == '') {
            alert('請輸入正確的數字');
            return;
        }
        $.ajax({
            url: '/api/get_area',
            type: 'get',
            data: {
                filename: $('#FileList button.active').text(),
                start: start,
                end: end
            },
            success: function (response) {
                if (response.success) {
                    var datasetId = $paramsBlock.data('dataset-id');
                    // 先刪除舊的 dataset
                    deleteDataset(datasetId);

                    $paramsBlock.find('.area-text').text('面積為' + response.area + 'N/s');
                    // 更新圖表
                    lineChart.data.datasets.push({
                        label: 'Area_' + datasetId,
                        id: datasetId,
                        data: response.data,
                        fill: true,
                        backgroundColor: 'rgba(255, 99, 132, 0.3)'
                    });
                    lineChart.update();
                } else {
                    alert(response.message);
                }
            }
        });
    });

    // 刪除區塊按鈕點擊事件
    $(document).on('click', '.delete-btn', function () {
        var $paramsBlock = $(this).closest('.params-block');
        var datasetId = $paramsBlock.data('dataset-id');
        $paramsBlock.remove();
        // 移除圖表資料
        deleteDataset(datasetId);
    });

    // 新增區塊按鈕點擊事件
    $('#AddBlockBtn').click(function () {
        addParamsBlock();
    });

    const lineCtx = $('#lineChart');
    var lineChart;
    const scatterCtx = $('#scatterChart');
    var scatterChart;

    function getChartData(filename) {
        var data = {
            filename: filename
        };
        $.ajax({
            url: '/api/get_chart_data',
            type: 'get',
            data: data,
            success: function (response) {
                if (response.success) {
                    const labels = response.data.Fx.map((_, i) => i + 1);
                    const data = response.data;
                    const datasets = [];
                    const colorMap = {
                        'Fx': 'rgb(75, 192, 192)',
                        'Fy': 'rgb(255, 99, 132)',
                        'Fz': 'rgb(54, 162, 235)',
                        'Mx': 'rgb(255, 205, 86)',
                        'My': 'rgb(153, 102, 255)',
                        'Mz': 'rgb(201, 203, 207)',
                        'COP(x)': 'rgb(255, 159, 64)',
                        'COP(y)': 'rgb(75, 192, 192)',
                    };
                    $.each(data, function (key, value) {
                        var dataset = {
                            label: key,
                            data: value,
                            fill: false,
                            borderColor: colorMap[key],
                            tension: 0.1
                        };
                        datasets.push(dataset);
                    });
                    initLineChart(datasets, labels);
                    initScaterChart(data);
                    $('.chart-block').show();
                    initParamsBlock();
                } else {
                    alert(response.message);
                }
            },
            error: function (response) {
                alert('發生錯誤');
            }
        });
    };

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
                                return Math.round((val / 1200) * 1000) / 1000;
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
                }
            }
        });
    };

    function initScaterChart(data) {
        if (scatterChart) {
            scatterChart.destroy();
        }
        scatterChart = new Chart(scatterCtx, {
            type: 'scatter',
            data: {
                datasets: [
                    {
                        label: 'COP(x) vs COP(y)',
                        data: data['COP(x)'].map((_, i) => ({ x: data['COP(x)'][i], y: data['COP(y)'][i] })),
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
                            text: 'COP(x)',
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
                            text: 'COP(y)',
                            color: 'red',
                        },
                        beginAtZero: true
                    }
                }
            }
        });
    };
    
    // 初始化ParamsBlock區塊
    function initParamsBlock() {
        // 只留下第一個區塊
        $('#ParamsBlocks').find('.params-block').not(':first').remove();
        addParamsBlock();
        $('#ParamsBlocks').show();
    };
    
    // 新增ParamsBlock區塊(用display:none的當模板，複製後再顯示)
    function addParamsBlock() {
        var $newBlock = $('.params-block').first().clone();
        $newBlock.find('input').val('');
        $newBlock.find('.area-text').text('');
        $newBlock.data('dataset-id', getNewDatasetId());
        $newBlock.show();
        $newBlock.insertBefore($('#AddBlockBtn'));
    };

    function getNewDatasetId() {
        var currentIds = $('.params-block').last().data('dataset-id');
        return currentIds + 1;
    }

    function deleteDataset(datasetId) {
        lineChart.data.datasets = lineChart.data.datasets.filter(dataset => dataset.id != datasetId);
        lineChart.update();
    }
});