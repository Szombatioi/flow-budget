path "transit/encrypt/flowbudget-kek" {
  capabilities = ["update"]
}

path "transit/decrypt/flowbudget-kek" {
  capabilities = ["update"]
}

path "transit/keys/flowbudget-kek" {
  capabilities = ["read"]
}
