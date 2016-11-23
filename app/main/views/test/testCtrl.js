'use strict';
ionicApp
.controller('testCtrl', ['$scope', 'Wallet',
function ($scope, Wallet) {

    $scope.genNewWallet = function(){
        $scope.wallet = Wallet.generate(false);
    };
}])
;