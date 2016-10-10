<?php
  require '../vendor/autoload.php';

  use Parse\ParseClient;
 
  ParseClient::initialize('3ys0OweLJxEIsXoH4Ak3AFfgN10SdkI0UrYjp1du', 'Jq5eyP1nFC9n0jYcAf2vkIcO0v2aP3EcNq1zzxnV', 'yK0Z9gJ9urUIR7mPOlK5cicJovYoLXRiHg4zs8XG');
  //ParseClient::setServerURL('http://YOUR_PARSE_SERVER:1337/parse');

  use Parse\ParseObject;

  define('CLIENT_ID', 'ca_8EMi64ylCs3rOl2IjndHPfQ6welR1A4L');
  define('API_KEY', 'sk_test_MJHXgUKGxKgq8TtGnNlicmUN');
  define('TOKEN_URI', 'https://connect.stripe.com/oauth/token');
  define('AUTHORIZE_URI', 'https://connect.stripe.com/oauth/authorize');
  if (isset($_GET['code'])) { // Redirect w/ code
    $code = $_GET['code'];
    $token_request_body = array(
      'client_secret' => API_KEY,
      'grant_type' => 'authorization_code',
      'client_id' => CLIENT_ID,
      'code' => $code,
    );
    $req = curl_init(TOKEN_URI);
    curl_setopt($req, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($req, CURLOPT_POST, true );
    curl_setopt($req, CURLOPT_POSTFIELDS, http_build_query($token_request_body));
    // TODO: Additional error handling
    $respCode = curl_getinfo($req, CURLINFO_HTTP_CODE);
    $resp = json_decode(curl_exec($req), true);
    curl_close($req);
    echo $resp['access_token'];
    echo var_dump($resp);

    $access_token = $resp['access_token'];
    $stripe_user_id = $resp['stripe_user_id'];
    $refresh_token = $resp['refresh_token'];

    // store on Parse

    $customer = new ParseObject("Merchant");

    // Set values:
    $customer->set("STRIPE_ACCOUNT_ID", $stripe_user_id);
    $customer->set("STRIPE_ACCESS_TOKEN", $access_token);
    $customer->set("STRIPE_REFRESH_TOKEN", $refresh_token);

    // Save:
    $customer->save();

  } else if (isset($_GET['error'])) { // Error
    echo $_GET['error_description'];
  } else { // Show OAuth link
    $authorize_request_body = array(
      'response_type' => 'code',
      'scope' => 'read_write',
      'client_id' => CLIENT_ID
    );
    $url = AUTHORIZE_URI . '?' . http_build_query($authorize_request_body);
    echo "<a href='$url'>Connect with Stripe</a>";
  }
?>