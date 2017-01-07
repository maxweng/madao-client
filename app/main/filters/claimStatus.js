
ionicApp.filter('claimStatus', ['$rootScope',function($rootScope){
    return function(status){
        var name = "";
        if(status==0){
            name = $rootScope.language.claimStatus1;
        }else if(status==6){
            name = $rootScope.language.claimStatus2;
        }else if(status==8){
            name = $rootScope.language.claimStatus3;
        }else{
            name = $rootScope.language.claimStatus4;
        }
        return name;
    }
}])
;
