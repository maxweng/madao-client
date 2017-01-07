
ionicApp.filter('claimBorderColor', ['$rootScope',function($rootScope){
    return function(status){
        if(status==6){
            return {'border-top': '2px dashed #4FACED'}
        }else{
            return {'border-top': '2px dashed #A8A8A8'}
        }
    }
}])
;
