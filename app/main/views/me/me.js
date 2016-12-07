'use strict';
ionicApp
.controller('meCtrl', ['$scope', '$state','Wallet','Me','globalFuncs',
'Wechat','$http','Coinprice','Coinorders','Ether',
function ($scope,$state, Wallet,Me,globalFuncs,Wechat,$http,Coinprice,Coinorders,Ether) {
    $scope.$on('$ionicView.beforeEnter', function(){
        $scope.me = {};
        Me.get().$promise.then(function(res){
            $scope.me = res;

            Coinorders.get().$promise.then(function(res){
                console.log(res)
            },function(msg){
                console.log(msg)
            });
        },function(err){
            $state.go('app.product');
        })

        Coinprice.get().$promise.then(function(res){
            $scope.advicedPrice = res.ethcny;
        },function(msg){
            alert(msg)
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
			$scope.blob = globalFuncs.getBlob("text/json;charset=UTF-8", $scope.wallet.toJSON());//未加密
			$scope.blobEnc = globalFuncs.getBlob("text/json;charset=UTF-8", $scope.wallet.toV3(password, {
				kdf: globalFuncs.kdf,
                n: globalFuncs.scrypt.n
			}));//加密
            $http({
                method: 'GET',
                url: $scope.blobEnc
            }).then(function successCallback(response) {
                console.log(response)
                $scope.privateKeyEnc = response.data;
            }, function errorCallback(response) {
                console.log(response)
                alert(response)
            });
            $scope.encFileName =  $scope.wallet.getV3Filename();
            $scope.isDone =  true;
        }
    }

    $scope.bindWallet = function(){
        $scope.me.address = $scope.wallet.getChecksumAddressString();
        $scope.me.encrypted_wallet_key = JSON.stringify($scope.privateKeyEnc);
        $scope.update($scope.me).$promise.then(function(res){
            $scope.me = res;
        },function(msg){
            alert(JSON.stringify(msg))
        })
    }

    $scope.decryptWallet = function(password) {
		$scope.addWalletStats = "";
        $scope.addAccount = {};
        try {
            var wallet = Wallet.getWalletFromPrivKeyFile($scope.me.encrypted_wallet_key, password);
            $scope.addAccount.password = password;
            $scope.addAccount.address = $scope.wallet.getAddressString();
		} catch (e) {
			alert(e)
		}
        Ether.getBalance({'balance':wallet.getAddressString(),'isClassic':true}).$promise.then(function(res){
            $scope.wallet = res.data;
            $scope.showWalletInfo = true;
        },function(msg){
            alert(msg);
        })
	};
}])
;
