'use strict';
ionicApp
.controller('meCtrl', ['$scope', '$state','Wallet','Me','globalFuncs',
'Wechat','$http','Coinprice','Coinorders','Ether','web3Provider','ethUnits',
function ($scope,$state, Wallet,Me,globalFuncs,Wechat,$http,Coinprice,Coinorders,Ether,web3Provider,ethUnits) {
    $scope.$on('$ionicView.beforeEnter', function(){
        $scope.me = {};
        Me.get().$promise.then(function(res){
            $scope.me = res;
            Coinorders.get().$promise.then(function(res){
                console.log(res)
            },function(msg){
                alert(JSON.stringify(msg))
            });
        },function(err){

        })

        Coinprice.get().$promise.then(function(res){
            $scope.advicedPrice = res.ethcny;
        },function(msg){
            alert(JSON.stringify(msg))
        });
    });

    $scope.password = "";
	$scope.wallet = null;
    $scope.isDone = true;
    $scope.showWallet = false;
    $scope.showWalletInfo = false;
    $scope.blob = $scope.blobEnc = "";
    $scope.creatWallet = function(password){
        if(!password||password.length<9){
            alert("请输入长度至少为9位的密码")
        }else if($scope.isDone){
            $scope.isDone = false;
			$scope.wallet = Wallet.generate(false);
			$scope.showWallet = true;
            //获得下载链接
			// $scope.blob = globalFuncs.getBlob("text/json;charset=UTF-8", $scope.wallet.toJSON());//未加密
			// $scope.blobEnc = globalFuncs.getBlob("text/json;charset=UTF-8", $scope.wallet.toV3(password, {
			// 	kdf: globalFuncs.kdf,
            //     n: globalFuncs.scrypt.n
			// }));//加密

            // $http({
            //     method: 'GET',
            //     url: $scope.blobEnc
            // }).then(function successCallback(response) {
            //     console.log(response)
            //     $scope.privateKeyEnc = response.data;
            // }, function errorCallback(response) {
            //     alert(JSON.stringify(response))
            // });
            $scope.privateKeyEnc = $scope.wallet.toV3(password, {
                kdf: globalFuncs.kdf,
                n: globalFuncs.scrypt.n
            });
            $scope.encFileName =  $scope.wallet.getV3Filename();
            $scope.isDone =  true;
        }
    }

    $scope.bindWallet = function(){
        $scope.me.address = $scope.wallet.getChecksumAddressString();
        $scope.me.encrypted_wallet_key = JSON.stringify($scope.privateKeyEnc);
        Me.update($scope.me).$promise.then(function(res){
            $scope.me = res;
        },function(msg){
            alert(JSON.stringify(msg))
        })
    }

    $scope.decryptWallet = function(password) {
		$scope.addWalletStats = "";
        try {
            var wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, password);
		} catch (e) {
			alert(e)
            return;
		}

        web3Provider.init(wallet.getAddressString(),wallet.getPrivateKeyString());
        window.mdc.balances(wallet.getAddressString()).then(function(res){
            $scope.balance = ethUnits.toEther(res.toNumber(),'wei');
        })
        Ether.getBalance({'balance':wallet.getAddressString(),'isClassic':true}).$promise.then(function(res){
            $scope.wallet = res.data;
            $scope.showWalletInfo = true;
        },function(msg){
            alert(JSON.stringify(msg));
        })
	};
}])
;
