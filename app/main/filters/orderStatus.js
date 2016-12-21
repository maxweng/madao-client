
ionicApp.filter('orderStatus', [function(){
    return function(status){
        var name = "";
        if(status==0){
            name = "初始化";
        }else if(status==2){
            name = "已支付";
        }else if(status==4){
            name = "发送中";
        }else if(status==6){
            name = "交易成功";
        }else if(status==8){
            name = "交易失败";
        }
        return name;
    }
}])
;
