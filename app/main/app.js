'use strict';
var ethUtil = require('ethereumjs-util');
ethUtil.crypto = require('crypto');
ethUtil.Tx = require('ethereumjs-tx');
ethUtil.scrypt = require('scryptsy');
ethUtil.uuid = require('uuid');

var ionicApp = angular.module('madaoClient', ['ionic', 'ui.router'])
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
        ;
    $urlRouterProvider.otherwise('/app/start');
}]);
