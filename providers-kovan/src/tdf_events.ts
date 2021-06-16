import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  TokenDotFactory,
  DotTokenCreated,
  OwnershipTransferred
} from "../generated/TokenDotFactory/TokenDotFactory"
import { Provider, Endpoint } from "../generated/schema"

// Contract addresses
let TDFADDRESS = Address.fromString("0xeC97E4896cF9f067a9dD428760316024EA0cfc12")

// create a new factory entity and save it.
export function handleDotTokenCreated(event: DotTokenCreated): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}
