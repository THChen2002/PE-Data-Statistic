$(document).ready(function () {
    // 上傳按鈕點擊事件
    $('form').submit(function (e) {
        e.preventDefault();
        // 受試者體重
        let weight = $('#weight').val();
        // 上傳的檔案
        let files = $('input[type=file]')[0].files;
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

    // 下載按鈕點擊事件
    $('#downloadBtn').click(function () {
        let filename = $(this).data('filename');
        if (filename) {
            path = '/download/' + filename;
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