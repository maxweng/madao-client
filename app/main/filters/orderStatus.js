
ionicApp.filter('orderStatus', ['$rootScope',function($rootScope){
    return function(status){
        var name = "";
        if(status==0){
            name = $rootScope.language.orderStatus1;
        }else if(status==2){
            name = $rootScope.language.orderStatus2;
        }else if(status==4){
            name = $rootScope.language.orderStatus3;
        }else if(status==6){
            name = $rootScope.language.orderStatus4;
        }else if(status==8){
            name = $rootScope.language.orderStatus5;
        }
        return name;
    }
}])
;
