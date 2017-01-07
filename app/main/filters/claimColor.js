
ionicApp.filter('claimColor', ['$rootScope',function($rootScope){
    return function(status){
        if(status==6){
            return {'background-color': '#00cb32'}
        }else{
            return {'background-color': '#A8A8A8'}
        }
    }
}])
;
