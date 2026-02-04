$(document).ready(function () {
    // 轉檔：上傳按鈕點擊事件
    $('#convertForm').submit(function (e) {
        e.preventDefault();
        // 受試者體重
        let weight = $('#weight').val();
        // 上傳的檔案
        let files = $('#convertForm input[type=file]')[0].files;
        // 勾選的項目
        let items = get_checked_items();
        if(!weight){
            alert('請輸入受試者體重');
            return;
        }
        if (files.length === 0) {
            alert('請選擇檔案');
            return;
        }
        let formData = new FormData();
        
        $('#submitBtn').hide();
        $('#loadBtn').show();
        $('#downloadBtn').hide();

        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        formData.append('items', items);
        formData.append('weight', weight);
        $.ajax({
            url: '/upload',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (response) {
                alert(response.message);
                let filename = response.filename;
                $('#submitBtn').show();
                $('#loadBtn').hide();
                $('#downloadBtn').data('filename', filename);
                $('#downloadBtn').show();
            },
            error: function (error) {
                alert('上傳失敗，請洽系統管理員');
                $('#submitBtn').show();
                $('#loadBtn').hide();
            }
        });
    });

    // 轉檔：下載按鈕點擊事件
    $('#downloadBtn').click(function () {
        let filename = $(this).data('filename');
        if (filename) {
            path = '/download/' + filename;
            window.open(path, '_blank');
        }
    });

    // 12 欄位 txt 刪除測力板區塊：送出事件
    $('#trimForm').submit(function (e) {
        e.preventDefault();

        let files = $('#trimForm input[type=file]')[0].files;
        let deleteBlock = $('input[name="delete_block"]:checked').val();

        if (files.length === 0) {
            alert('請選擇要處理的檔案');
            return;
        }

        let formData = new FormData();

        $('#trimSubmitBtn').hide();
        $('#trimLoadBtn').show();
        $('#trimDownloadBtn').hide();

        for (let i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        formData.append('delete_block', deleteBlock);

        $.ajax({
            url: '/trim_upload',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (response) {
                if (!response.success) {
                    // 失敗時若有提供 not_12_files，也一併顯示
                    if (response.not_12_files && response.not_12_files.length > 0) {
                        alert(
                            (response.message || '處理失敗，請洽系統管理員') +
                            '\n以下檔案欄位數不是 12 欄：\n' +
                            response.not_12_files.join('\n')
                        );
                    } else {
                        alert(response.message || '處理失敗，請洽系統管理員');
                    }
                    $('#trimSubmitBtn').show();
                    $('#trimLoadBtn').hide();
                    return;
                }

                let extraMsg = '';
                if (response.skipped_not_12 && response.skipped_not_12 > 0 && response.not_12_files && response.not_12_files.length > 0) {
                    extraMsg =
                        '\n※ 下列檔案因欄位數不是 12 欄，未被處理：\n' +
                        response.not_12_files.join('\n');
                }

                alert('處理完成，請點選下載壓縮檔' + extraMsg);

                let zipname = response.zip_name;
                $('#trimSubmitBtn').show();
                $('#trimLoadBtn').hide();
                $('#trimDownloadBtn').data('zipname', zipname);
                $('#trimDownloadBtn').show();
            },
            error: function (error) {
                alert('處理失敗，請洽系統管理員');
                $('#trimSubmitBtn').show();
                $('#trimLoadBtn').hide();
            }
        });
    });

    // 12 欄位 txt 刪除測力板區塊：下載壓縮檔
    $('#trimDownloadBtn').click(function () {
        let zipname = $(this).data('zipname');
        if (zipname) {
            let path = '/download_trim/' + zipname;
            window.open(path, '_blank');
        }
    });

    function get_checked_items(){
        let checked_items = [];
        $('#checkList input:checked').each(function(){
            checked_items.push($(this).val());
        });
        return checked_items;
    }
});