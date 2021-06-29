import { BigInt, Address, log, store } from "@graphprotocol/graph-ts"
import {
  Bondage,
  Bound,
  Unbound,
  Escrowed,
  Released,
  Returned,
  OwnershipTransferred
} from "../generated/Bondage/Bondage"
import { Registry } from "../generated/Bondage/Registry"
import { Endpoint, User, Bond } from "../generated/schema"

// Contract Addresses
let BONDADDRESS = Address.fromString("0x188f79B0a8EdC10aD53285c47c3fEAa0D2716e83")
let REGADDRESS = Address.fromString("0xC7Ab7FFc4FC2f3C75FfB621f574d4b9c861330f0")

// Updates an endpoint's dots issued and # of zap bounded
export function handleBound(event: Bound): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(event.params.endpoint.toHex())
  if (endpoint == null) return
  let user = User.load(event.transaction.from.toHex())
  if (user == null) {
    user = new User(event.transaction.from.toHex())
  }
  let bondID = event.transaction.from.toHex() + event.params.endpoint.toHex()
  let bond = Bond.load(bondID)
  if (bond == null) {
    bond = new Bond(bondID)
    bond.user = user.id
    bond.endpoint = endpoint.id
  }

  let bondage = Bondage.bind(BONDADDRESS)  // connection to the Bondage contract
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(event.transaction.to as Address, event.params.endpoint)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(event.transaction.to as Address, event.params.endpoint)
  if (zapBoundResult.reverted) {
    // Do nothing
  } else {
    endpoint.zapBound = zapBoundResult.value
  }

  // updates the number of user-bound dots
  if (bond.bounded == null){
    bond.bounded = event.params.numDots
  } else {
    bond.bounded.plus(event.params.numDots)
  }
  bond.timestamp = event.block.timestamp
  bond.save()

  if (!user.userBound.includes(bond.id)) {
    user.userBound.push(bond.id)
  }
  log.info("Succesfully Bonded to {}.", [endpoint.endpointStr])    
  user.save()
  
  let spotPrice = bondage.try_calcZapForDots(event.transaction.to as Address, event.params.endpoint, BigInt.fromI32(1))
  if (!spotPrice.reverted) {
    endpoint.spotPrice = spotPrice.value
    endpoint.save()
  } else {
    log.warning("Error with getting spotprice for {}", [endpoint.endpointStr])
    return
  }
}

// Updates an endpoint's dots issued and # of zap bounded
export function handleUnbound(event: Unbound): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(event.params.endpoint.toHex())
  let user = User.load(event.transaction.from.toHex())
  let bondID = (event.transaction.from.toHex() + event.params.endpoint.toHex())
  let bond = Bond.load(bondID)
  if (endpoint == null || bond == null || user == null) return

  let bondage = Bondage.bind(BONDADDRESS)
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(event.transaction.to as Address, event.params.endpoint)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(event.transaction.to as Address, event.params.endpoint)
  if (zapBoundResult.reverted) {
    // Do nothing
  } else {
    endpoint.zapBound = zapBoundResult.value
  }

  // updates the number of user-bound dots
  if (bond.bounded === BigInt.fromI32(0) || bond.bounded == null) {
    // if the user is not active on the protocol, remove their entity
    log.info("User no longer bonded to {}, removing Bond entity.", [bond.endpoint])
    store.remove("Bond", bond.id)
  } else {
    bond.bounded.minus(event.params.numDots)
    bond.save()
  }
  
  let spotPrice = bondage.try_calcZapForDots(event.transaction.to as Address, event.params.endpoint, BigInt.fromI32(1))
  if (!spotPrice.reverted) {
    endpoint.spotPrice = spotPrice.value
  } else {
    log.warning("Error with getting spotprice for {}", [endpoint.endpointStr])
    return
  }
  
  log.info("Successfully unbonded to {}.", [endpoint.endpointStr])
  endpoint.save()

}

export function handleEscrowed(event: Escrowed): void { }

export function handleReleased(event: Released): void {
  // let endpoint = Endpoint.load(event.params.endpoint.toHex())
  // if (endpoint == null) return
  // let bondage = Bondage.bind(BONDADDRESS)

  // endpoint.dotsIssued = bondage.getDotsIssued(Address.fromString(event.params.oracle.toString()), event.params.endpoint)

  // endpoint.save()
}

export function handleReturned(event: Returned): void { }

export function handleOwnershipTransferred(event: OwnershipTransferred): void { }
