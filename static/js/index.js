$(document).ready(function () {
    // 上傳按鈕點擊事件
    $('#submitBtn').click(function () {
        var formData = new FormData();
        var files = $('input[type=file]')[0].files;
        if (files.length == 0) {
            alert('請選擇檔案');
            return;
        }
        $(this).hide();
        $('#loadBtn').show();
        $('#downloadBtn').hide();

        for (var i = 0; i < files.length; i++) {
            formData.append('files', files[i]);
        }
        items = get_checked_items();
        formData.append('items', items);
        // formData.append('items', JSON.stringify(items));
        $.ajax({
            url: '/upload',
            type: 'post',
            data: formData,
            contentType: false,
            processData: false,
            success: function (response) {
                alert(response.message);
                var filename = response.filename;
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
        var filename = $(this).data('filename');
        if (filename) {
            path = '/download/' + filename;
            window.open(path, '_blank');
        }
    });

    function get_checked_items(){
        var checked_items = [];
        $('#CheckList input:checked').each(function(){
            checked_items.push($(this).val());
        });
        return checked_items;
    };
});