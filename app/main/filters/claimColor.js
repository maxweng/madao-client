
ionicApp.filter('claimColor', ['$rootScope',function($rootScope){
    return function(status){
        if(status==6){
            return {'background-color': '#4FACED'}
        }else{
            return {'background-color': '#A8A8A8'}
        }
    }
}])
;