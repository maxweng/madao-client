'use strict';
ionicApp
.factory('Ether', ['$resource', '$q',
function($resource,$q){
    var Ether = $resource('/api', {}, {
        //balance: addr
		//isClassic: true
        getBalance: {
            method: 'POST'
        },
        //txdata: addr
		//isClassic: true
        getTransactionData: {
            method: 'POST'
        },
        // txId: The transaction hash
        // isClassic: true
        getTransaction: {
            method: 'POST'
        },
        //rawtx: rawTx,
		//isClassic: true
        sendRawTx: {
            method: 'POST'
        },
        // estimatedGas: txobj,
		// isClassic: true
        getEstimatedGas: {
            method: 'POST'
        },
        // ethCall: txobj,
		// isClassic: true
        getEthCall: {
            method: 'POST'
        }
    });

    return Ether;
}]);
