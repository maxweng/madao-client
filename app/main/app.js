'use strict';
window.ethUtil = require('ethereumjs-util');
ethUtil.crypto = require('crypto');
ethUtil.scrypt = require('scryptsy');
ethUtil.uuid = require('uuid');
ethUtil.Tx = require('ethereumjs-tx');
window.Web3 = require('web3');
window.BufferObject = require('buffer');
window.MDC = require('./MDC.sol.js');
window.HookedWeb3Provider = require('hooked-web3-provider');
window.MBSProvider = require('./MBSProvider.js');

window.ionicApp = angular.module('madaoClient', ['ionic', 'ui.router','ngResource'])
.run(['$rootScope','Wechat','Me','LANGUAGE','APP_CONFIG',function ($rootScope,Wechat,Me,LANGUAGE,APP_CONFIG) {
    $rootScope.language = LANGUAGE[APP_CONFIG.language];
    // Me.get().$promise.then(function(me){
    //
    // },function(err){
    //     Wechat.loginWechat(function(){
    //         console.log('登录成功')
    //     },function(msg){
    //         console.log(msg)
    //     });
    // })
}])
.config(['$ionicConfigProvider', function($ionicConfigProvider) {
    $ionicConfigProvider.navBar.alignTitle('center');
    $ionicConfigProvider.backButton.icon('ion-ios-arrow-back').previousTitleText(false);
    $ionicConfigProvider.platform.android.backButton.text('返回');
    $ionicConfigProvider.platform.ios.backButton.text('返回');
    $ionicConfigProvider.platform.android.tabs.style('standard');
    $ionicConfigProvider.views.transition('android');
    $ionicConfigProvider.platform.android.tabs.position('bottom');
}])
.config(['$compileProvider', function($compileProvider){
    $compileProvider.aHrefSanitizationWhitelist(/^\s*(https?|ftp|blob|mailto|file):/);
}])
.config(['$stateProvider', '$urlRouterProvider', '$httpProvider',
function ($stateProvider, $urlRouterProvider, $httpProvider) {
    $httpProvider.interceptors.push('httpInterceptor');

    $stateProvider
        .state('app', {
            url: '/app',
            templateUrl: 'templates/app.html',
            abstract: true,
        })
        .state('app.start', {
            url: '/start',
            views: {
                menuContent: {
                    templateUrl: 'templates/start.html'
                }
            }
        })
        .state('app.tabs', {
            url: '/tabs',
            views: {
                menuContent: {
                    templateUrl: 'templates/tabs.html'
                }
            },
            abstract: true
        })
        .state('app.tabs.me', {
            url: '/me',
            views: {
                tabContent: {
                    templateUrl: 'templates/me.html',
                    controller: 'meCtrl'
                }
            }
        })
        .state('app.tabs.myHome', {
            url: '/myHome',
            views: {
                tabContent: {
                    templateUrl: 'templates/myHome.html',
                    controller: 'myHomeCtrl'
                }
            }
        })
        .state('app.tabs.addFlight', {
            url: '/addFlight',
            views: {
                tabContent: {
                    templateUrl: 'templates/addFlight.html',
                    controller: 'addFlightCtrl'
                }
            }
        })
        .state('app.tabs.claims', {
            url: '/claims',
            views: {
                tabContent: {
                    templateUrl: 'templates/claims.html',
                    controller: 'claimsCtrl'
                }
            }
        })
        .state('app.tabs.product', {
            url: '/product',
            views: {
                tabContent: {
                    templateUrl: 'templates/product.html',
                    controller: 'productCtrl'
                }
            }
        })
        .state('app.provision', {
            url: '/provision',
            views: {
                menuContent: {
                    templateUrl: 'templates/provision.html'
                }
            }
        })
        .state('app.process', {
            url: '/process',
            views: {
                menuContent: {
                    templateUrl: 'templates/process.html'
                }
            }
        })
        .state('app.productDetail', {
            url: '/productDetail',
            views: {
                menuContent: {
                    templateUrl: 'templates/productDetail.html',
                    controller: 'productDetailCtrl'
                }
            }
        })
        .state('app.test', {
            url: '/test',
            views: {
                menuContent: {
                    templateUrl: 'templates/test.html',
                    controller: 'testCtrl'
                }
            }
        })
        ;
    $urlRouterProvider.otherwise('/app/tabs/product');
}]);
