ionicApp
.factory('navBar', ['$ionicHistory', '$state', '$rootScope', 'APP_CONFIG', '$q',
function($ionicHistory, $state, $rootScope, APP_CONFIG, $q){
    var paramsEquals = function(params1, params2){
        if(params1 === params2){
            return true;
        }
        var keys1 = (angular.isObject(params1) && Object.getOwnPropertyNames(params1)) || [];
        var keys2 = (angular.isObject(params2) && Object.getOwnPropertyNames(params2)) || [];
        if(keys1.length !== keys2.length){
            return false;
        }
        for(var i = 0,key;i < keys1.length; i++){
            key = keys1[i];
            if(angular.isUndefined(params2[key]) || params1[key].toString() != params2[key].toString()){
                return false;
            }
        }
        for(var i = 0,key;i < keys2.length; i++){
            key = keys2[i];
            if(angular.isUndefined(params1[key]) || params1[key].toString() != params2[key].toString()){
                return false;
            }
        }
        return true;
    };
    return {
        goBack: function(stateName, params, backCount){
            backCount = backCount || -1;
            if($ionicHistory.backView() && $ionicHistory.backView().index + backCount >= -1){
                var deferred = $q.defer();
                $ionicHistory.goBack(backCount);
                deferred.resolve();
                return deferred.promise;
            }else{
                $ionicHistory.nextViewOptions({
                    disableBack: true,
                    historyRoot: true
                });
                $state.go(stateName, params, {location: 'replace'});
            }
        },
        replace: function(stateName, _params){
            var backView = $ionicHistory.backView();
            var params = angular.copy(_params);

            if(backView && backView.stateName === stateName && paramsEquals(backView.stateParams, params)){
                var deferred = $q.defer();
                $ionicHistory.goBack();
                deferred.resolve();
                return deferred.promise;
            }else{
                $ionicHistory.nextViewOptions({
                    disableBack: true,
                    historyRoot: true
                });
                return $state.go(stateName, params, {location: 'replace'}).then(function(){
                    $ionicHistory.backView(null);
                });
            }
        },
        loginSuccess: function(){
            $ionicHistory.currentView($ionicHistory.backView());
            if($rootScope.returnToState){
                this.replace($rootScope.returnToState, $rootScope.returnToParams, {location: 'replace'}).then(function(){
                    $rootScope.returnToState = null;
                    $rootScope.returnToParams = null;
                });
            }else{
                this.replace(APP_CONFIG.homePage, {}, {location: 'replace'});
            }
        },
        replaceTo: function(stateName, params){
            var backView = $ionicHistory.backView();
            if(backView && backView.stateName === stateName && paramsEquals(backView.stateParams, params)){
                var deferred = $q.defer();
                $ionicHistory.goBack();
                deferred.resolve();
                return deferred.promise;
            }else{
                $ionicHistory.currentView($ionicHistory.backView());
                return $state.go(stateName, params, {location: 'replace'});
            }
        },
        toLogin: function(returnToState, returnToParams){
            $rootScope.returnToState =  returnToState || $state.current.name;
            $rootScope.returnToParams = returnToParams || $state.params;
            $state.go('app.login');
        }
    }
}])
;
