
// Cashy cloud code
// 2016. Giuseppe Capoluongo. All rights reserved.

// ----------------------------------------------- //

// ----------- CONFIGURATIONS ----------- //
// STRIPE
var stripe = require('stripe');
stripe.initialize('sk_test_MJHXgUKGxKgq8TtGnNlicmUN');
// TWILIO SMS
var twilio = require("twilio");
twilio.initialize("ACd49e6d60fa1b281759f2b8f365dc671d","353d383d939484dd5e31eeb41af4f15a");

// ---------- BASIC FUNCTIONS ---------- //

// GET USER OBJECT BY ID
function getUserById(userId){
    Parse.Cloud.useMasterKey();
    var findUser = new Parse.Query(Parse.User);
    findUser.equalTo("objectId", userId);
    return findUser.first({
        success: function(userRetrieved){
          return userRetrieved
        },
        error: function(error){
          return error
        }
    })
}

// FIND CARD OBJECT BY USER ID
function findCardByUserId(userId){
  Parse.Cloud.useMasterKey();
  return getUserById(userId).then(function(user){
    var Card = Parse.Object.extend("Card")
    var findCardByUser = new Parse.Query(Card)
    findCardByUser.equalTo("user", user)
      return findCardByUser.first({
        success: function(cardObj){
          return cardObj
        },
        error: function(error){
          return error
        }
      })
  }, 
   function(error){
      return error
  })
}

function getShopById(shopId){
  Parse.Cloud.useMasterKey();
  var Shop = Parse.Object.extend("Shop")
  var findShopById = new Parse.Query(Shop)
  findShopById.equalTo("objectId", shopId);
  return findShopById.first({
    success: function(shopObj){
      return shopObj
    },
    error: function(error){
      return error
    }
  })
}

// GET MERCHANT OBJECT FROM SHOP ID
function getMerchantFromShopId(shopId){
  Parse.Cloud.useMasterKey();
  var Merchant = Parse.Object.extend("Merchant")
  return getShopById(shopId).then(
    function(shopObj){
      var findMerchant = new Parse.Query(Merchant)
      findMerchant.equalTo("shop", shopObj)
      return findMerchant.first({
        success: function(merchantObj){
          return merchantObj
        },
        error: function(error){
          return error
        }
      })
    }, 
    function(error){
      return
    }
  )
}

// --------  SIGN UP  -------- //

// SIGNUP (phoneNumber, username, password)
// Do all the things about signing up
Parse.Cloud.define("signUp", function(req, res) {
  Parse.Cloud.useMasterKey();
  var phoneNumber = req.params.phoneNumber;
  var userId = req.params.userId;
  getUserById(userId).then(function(user){

    var code = "";
    var possible = "0123456789";

    for( var i=0; i < 6; i++ )
        code += possible.charAt(Math.floor(Math.random() * possible.length));

    // save code on cloud 
    var VerifyPhone = Parse.Object.extend("VerifyPhone");
    var verifyPhone = new VerifyPhone();

    verifyPhone.set("code", code)
    verifyPhone.set("user", user)
    verifyPhone.set("confirmed", false)

    verifyPhone.save(null, {      
        success: function(ver){
            twilio.sendSMS(
            {
              from: "+12057198235",
              to: "+39"+phoneNumber,
              body: "Your verification code for Cashy is " + code
            }, 
            { 
              success: function(responseData) { 
                res.success()
              }
            },
            { 
              error: function(error){
                res.error(error)
              }
            }
          )
        },
        error: function(ver, error) {
          res.error(error)
        }
    })
  }, function(error){
    res.error()
  })
      
})

// VERIFY CODE
Parse.Cloud.define("verifyCode", function(request, response){
  Parse.Cloud.useMasterKey();
  var phoneNumber = request.params.phoneNumber
  var userId = request.params.userId
  var code = request.params.verificationCode
  getUserById(userId).then(function(user){
    console.log("USERID:"+user.id)
    var VerifyPhone = Parse.Object.extend("VerifyPhone")
    var query = new Parse.Query(VerifyPhone)
        query.equalTo("user", user)
        query.equalTo("code", code)
        query.first({
          success: function(verifyPhoneObj){
            console.log("VERIFYPHONEID:" + verifyPhoneObj)
            var confirmed = verifyPhoneObj.get("confirmed")
            if (!confirmed) {
              verifyPhoneObj.set("confirmed", true)
              verifyPhoneObj.save(null,{
                success: function(ver){
                    response.success(ver)
                },
                error: function(error){
                    response.error()
                }
              })
            } else {
              response.error()
            }
          },
          error: function(error){
            response.error()
          }
        })
  }, 
  function(error){
      response.error()
  })
})

// SAVE A NEW CUSTOMER(userId, cardToken)
// Save payment token (customer id) for future payments
// TODO

Parse.Cloud.define("saveNewCustomer", function(request, response){
  var stripeToken = request.params.stripeToken;
  stripe.Customers.create({
    source: stripeToken,
    description: 'new customer!'
  }).then(function(customer) {
    // YOUR CODE: Save the customer ID and other info in a database for later!

  }).then(null, function(error){
    response.error("Error during saving customer: " + error)
  }).then(function(){
    response.success("Saved!")
  })
});


// ------------ PAY ----------- //
// Pay transfers money from your credit card to merchant's stripe account

Parse.Cloud.define("pay", function(request, response) {
		var cardToken = request.params.cardToken
    var amount = request.params.amount
    var customer = request.params.cus
    var destination = request.params.destination
		var charge = stripe.Charges.create({
      		amount: amount * 100, // express dollars in cents 
      		currency: 'eur',
      		customer: customer,
          // IF I SET DESTINATION, MONEY ARE AUTOMATICALLY TRANSFERRED TO MERCHANT ACCOUNT
          destination: destination,
          // MY FEE 
          application_fee: 50
    }).then(null, function(error) {
      	response.error('Charging with stripe failed. Error: ' + error)
    }).then(function(user){
          response.success("Charged!")
    })
});

// PAY WITH GIFT
// Pay using an existing gift
Parse.Cloud.define("payGift", function(req, res) {
  var code = req.params.code
  var shopId = req.params.shopId
  var userId = req.params.userId
  var Gift = Parse.Object.extend("Gift")
  var query = new Parse.Query(Gift)
  query.equalTo("code", code)
  query.first({
    success: function(result){
      var amount = result.get("value")
      return getMerchantFromShopId(shopId).then(
        function(merchant){
        var accountId = merchant.get("STRIPE_ACCOUNT_ID")
        console.log("MERCHANT: " + merchant.id)
        return findCardByUserId(userId).then(
        function(card){
          var cusId = card.get("customerId")
          // make payment (payout)
          var params = {'amount': amount*100, 'destination': accountId}
          Parse.Cloud.httpRequest({
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            url: "http://giuseppecapoluongo.com/payout/payout.php",
            body: params,
            success: function(httpResponse) {
                res.success(httpResponse.text)
            },
            error: function(error) {
                res.error(error)
            }
          })
        }, 
        function(error){
          res.error(error)
        }
        )
      }, 
      function(error){
        res.error(error)
      }
      )
    },
    error: function(error){
      res.error(error)
    }
  })
})

// -------- NEW GIFT ------- //

// GIFT CHARGE
// Charge Cashy stripe account for gift.

function giftCharge(cus, amount){
  Parse.Cloud.useMasterKey();
  return stripe.Charges.create({
          amount: amount * 100, // express dollars in cents 
          currency: 'eur',
          customer: cus
    }).then(null, function(error) {
        return error
    }).then(function(user){
        return user
    })
}


// SAVE GIFT
// Generate a gift code and save it into the DB. Then send SMS with gift code. 

function saveGift(fromUser, toUser, giftValue, phone){
    Parse.Cloud.useMasterKey();
    // GENERETE A CODE FOR THE GIFT
    var code = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

    for( var i=0; i < 6; i++ )
        code += possible.charAt(Math.floor(Math.random() * possible.length));
    var Gift = Parse.Object.extend("Gift");
    var gift = new Gift();

    gift.set("fromUser", fromUser);
    gift.set("toUser", toUser);
    gift.set("value", giftValue);
    gift.set("isValid", true);
    gift.set("code", code);

    return gift.save(null, {
      success: function(gift) {
        // Execute any logic that should take place after the object is saved.
        twilio.sendSMS({
        from: "+12057198235",
        to: phone,
        body: "Your code is " + code
        }, 
        { success: function(responseData) { //this function is executed when a response is received from Twilio
            return responseData; // outputs "+14506667788"
            }},
        { error: function(error){
            return error;
        }}
        );
      },
      error: function(gift, error) {
        // Execute any logic that should take place if the save fails.
        // error is a Parse.Error with an error code and message.
        return error;
      }
    });
}

// NEW GIFT 
// Do all the things about new Gift

Parse.Cloud.define("newGift", function(request, response){
  findCardByUserId(request.params.fromUser).then(function(card){

    giftCharge(card.get("customer_id"), request.params.amount).then(
      function(success){  
        var fromUserId = request.params.fromUser;
        var toUserId = request.params.toUser;
        var value = request.params.amount;
        getUserById(fromUserId).then(
          function(fromUser){
                getUserById(toUserId).then(
                  function(toUser){
                        saveGift(fromUser, toUser, value, toUser.get("phone")).then(
                          function(gift){
                          response.success("Everything went good")
                        }, function(error){
                          response.error("Something went wrong " + error)
                        })
                  },
                  function(error){response.error(error)}
                )
            },
            function(error){response.error(error)}
        )
    }, 
    function(error){response.error(error)}
  )

  }
    , function(error){

    })
})

// SETTINGS - GET COSTUMER INFO
Parse.Cloud.define("getCustomerInfo", function(request, response){
  var userId = request.params.userId
  findCardByUserId(userId).then(
    function(card){
      var customer = card.get("customer_id")
      stripe.Customers.retrieve(
      customer,
      function(err, customer) {
        // asynchronously called
        if (!err){
          response.success(customer)
        } else {
          response.error(err)
        }
      }
      ).then(function(customer){response.success(customer)}, function(error){response.error(error)})
    }, 
    function(error){
      response.error(error)
    })
})
