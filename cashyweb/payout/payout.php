<?
require '../vendor/autoload.php';

$amount = filter_input(INPUT_POST, "amount", FILTER_VALIDATE_INT);
//$amount = $_POST["amount"];
$destination = $_POST["destination"];
echo "STUPID: ".$amount."STUFF ".$destination;

\Stripe\Stripe::setApiKey("sk_test_MJHXgUKGxKgq8TtGnNlicmUN");

\Stripe\Transfer::create(array(
  "amount" => $amount,
  "currency" => "eur",
  "destination" => $destination,
  "description" => "Transfer for test@example.com"
));
?>