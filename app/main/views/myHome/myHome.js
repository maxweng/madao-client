'use strict';
ionicApp
.controller('myHomeCtrl', ['$scope', '$state','Wechat','Me','$timeout','$ionicLoading','web3Provider','walletManage','Coinprice','Ether',
function ($scope,$state, Wechat,Me,$timeout,$ionicLoading,web3Provider,walletManage,Coinprice,Ether) {
    $scope.$on('$ionicView.beforeEnter', function(){
        walletManage($scope, function(modal){
            $scope.modal = modal;
        });
        Coinprice.get().$promise.then(function(res){
            $scope.advicedPrice = res.ethcny;
        },function(msg){
            console.log(msg)
            alert("获取ETH和RMB汇率失败")
        });
        $scope.me = {};
        $timeout(function(){
            Me.get().$promise.then(function(res){
                if(!Wechat.hasAccessToken())Wechat.getAccessToken();
                $scope.me = res;
                web3Provider.init($scope.me.address,'');
                if(!$scope.me.encrypted_wallet_key){
                    $scope.modal.showModal();
                }
                getData = function(){

                }
                window.mdc.balances($scope.$root.address).then(function(res){
                    $scope.balance = res.toNumber();
                })
                Ether.getBalance({'balance':$scope.me.address,'isClassic':true}).$promise.then(function(res){
                    $scope.walletBalance = res.data.balance;
                });
            },function(err){
                Wechat.loginWechat(function(){
                    console.log('登录成功')
                },function(msg){
                    console.log(msg)
                });
            })
        })
        if(Wechat.hasAccessToken()){
            $timeout(function(){
                Me.get().$promise.then(function(res){
                    $scope.me = res;
                },function(err){

                })
            },2000)
        }
    });
}])
;
