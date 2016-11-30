'use strict';
 window.ethUtil = require('ethereumjs-util');
 ethUtil.crypto = require('crypto');
 ethUtil.scrypt = require('scryptsy');
 ethUtil.uuid = require('uuid');
 ethUtil.Tx = require('ethereumjs-tx');
 window.BufferObject = require('buffer');

window.ionicApp = angular.module('madaoClient', ['ionic', 'ui.router','ngResource'])
.run([function () {

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
        .state('app.provision', {
            url: '/provision',
            views: {
                menuContent: {
                    templateUrl: 'templates/provision.html'
                }
            }
        })
        .state('app.product', {
            url: '/product',
            views: {
                menuContent: {
                    templateUrl: 'templates/product.html',
                    controller: 'productCtrl'
                }
            }
        })
        .state('app.productDetail', {
            url: '/product/:id',
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
    $urlRouterProvider.otherwise('/app/product');
}]);
