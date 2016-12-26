
ionicApp.filter('claimStatus', [function(){
    return function(status){
        var name = "";
        if(status==0){
            name = "理赔初始化";
        }else if(status==6){
            name = "理赔审核成功";
        }else if(status==8){
            name = "理赔审核失败";
        }else{
            name = "理赔审核中";
        }
        return name;
    }
}])
;
