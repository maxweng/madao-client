
ionicApp.filter('claimStatus', [function(){
    return function(status){
        var name = "";
        if(status==0){
            name = "初始化";
        }else if(status==6){
            name = "审核成功";
        }else if(status==8){
            name = "审核失败";
        }else{
            name = "审核中";
        }
        return name;
    }
}])
;
