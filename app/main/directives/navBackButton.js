ionicApp
.directive('navBackButton', ['navBar', 'APP_CONFIG', function(navBar, APP_CONFIG){
    return {
        restrict: 'E',
        transclude: true,
        replace: true,
        template: '<button class="button button-clear button-stable"><i class="icon ion-ios-arrow-left"></i>返回</button>',
        link: function(scope, elem){
            elem.on('click', function(){
                navBar.goBack(APP_CONFIG.homePage);
            });
        }
    }
}])
;
