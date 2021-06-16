import { BigInt, Address } from "@graphprotocol/graph-ts"
import {
  TokenDotFactory,
  DotTokenCreated,
  OwnershipTransferred
} from "../generated/TokenDotFactory/TokenDotFactory"
import { Provider, Endpoint } from "../generated/schema"

// Contract addresses
let TDFADDRESS = Address.fromString("0xe13fef4c8e75c12f9706e8bdf28fe847ce99cb42")

// create a new factory entity and save it.
export function handleDotTokenCreated(event: DotTokenCreated): void {}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}
