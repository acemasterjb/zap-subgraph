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
import { Registry } from "../generated/Registry/Registry"
import { Provider, Endpoint, User, Bond } from "../generated/schema"

import {getEnd, getZapRequired} from "./utils"

// Contract Addresses
let BONDADDRESS = Address.fromString("0x188f79B0a8EdC10aD53285c47c3fEAa0D2716e83")
let REGADDRESS = Address.fromString("0xC7Ab7FFc4FC2f3C75FfB621f574d4b9c861330f0")

// Updates an endpoint's dots issued and # of zap bounded
export function handleBound(event: Bound): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(event.params.endpoint.toHex())
  if (endpoint == null) return
  let user = User.load(event.params.holder.toHex())
  if (user == null) {
    user = new User(event.params.holder.toHex())
  }
  let bondID = event.params.holder.toHex() + event.params.endpoint.toHex() + event.transaction.hash.toHexString()
  let bond = Bond.load(bondID)
  if (bond == null) {
    bond = new Bond(bondID)
    bond.user = user.id
    bond.endpoint = endpoint.id
  }

  let bondage = Bondage.bind(BONDADDRESS)  // connection to the Bondage contract
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(event.params.oracle, event.params.endpoint)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(event.params.oracle, event.params.endpoint)
  if (zapBoundResult.reverted) {
    // Do nothing
  } else {
    endpoint.zapBound = zapBoundResult.value
  }

  // updates the number of user-bound dots
  let boundedResult = bondage.try_getBoundDots(event.params.holder, event.params.oracle, event.params.endpoint)
  if (boundedResult.reverted) {
    bond.bounded = null
    log.debug("Error in getting the user bound dots on endpoint {} for user {}.", [event.params.endpoint.toString(), event.params.holder.toHex()])
  } else {
    bond.bounded = boundedResult.value
    bond.timestamp = event.block.timestamp
    bond.save()

    if (!user.userBound.includes(bond.id)) {
      user.userBound.push(bond.id)
    }
    log.info("Succesfully Bonded to {}.", [endpoint.endpointStr])    
    
    const curve = registry.try_getProviderCurve(event.params.oracle, event.params.endpoint)
    const dotsIssued = bondage.try_getDotsIssued(event.params.oracle, event.params.endpoint)
    if (!curve.reverted && !dotsIssued.reverted){
      endpoint.spotPrice = getZapRequired(dotsIssued.value, BigInt.fromI32(1), getEnd(curve.value), curve.value)
      if (endpoint.spotPrice == BigInt.fromI32(0)){
        log.warning("Unable to get spotprice from {}", [endpoint.endpointStr])
      }
    }

    // save the entities
    endpoint.save()
    user.save()
  }
}

// Updates an endpoint's dots issued and # of zap bounded
export function handleUnbound(event: Unbound): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(event.params.endpoint.toHex())
  let user = User.load(event.params.holder.toHex())
  let bondID = (event.params.holder.toHex() + event.params.endpoint.toHex())
  let bond = Bond.load(bondID)
  if (endpoint == null || bond == null || user == null) return

  let bondage = Bondage.bind(BONDADDRESS)
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(Address.fromString(event.params.oracle.toHex()), event.params.endpoint)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(Address.fromString(event.params.oracle.toHex()), event.params.endpoint)
  if (zapBoundResult.reverted) {
    // Do nothing
  } else {
    endpoint.zapBound = zapBoundResult.value
  }

  // updates the number of user-bound dots
  let boundedResult = bondage.try_getBoundDots(event.params.holder, event.params.oracle, event.params.endpoint)
  if (boundedResult.reverted) {
    bond.bounded = BigInt.fromI32(0)
    log.debug("Error in getting the user bound dots on endpoint {} for user {}.", [event.params.endpoint.toString(), event.params.holder.toHex()])
    bond.save()
  } else {
    bond.bounded = boundedResult.value

    // if the user is not bound to the endpoint, remove
    // user metadata for that endpoint
    if (boundedResult.value == BigInt.fromI32(0) || boundedResult.value == null) {
      // let endpointIndex = user.endpoints.indexOf(endpoint.id)
      let userBoundIndex = user.userBound.indexOf(bond.id)

      // removes elements at the specified index
      // if (endpointIndex != -1){
      //   user.endpoints.splice(endpointIndex, 1)
      // }
      if (userBoundIndex != -1) {
        user.userBound.splice(userBoundIndex, 1)
      }

      // if the user is not active on the protocol, remove their entity
      // if (user.endpoints.length == 0 && user.owns.length == 0 && user.userBound.length == 0){
      //   log.info("User {} is no longer active, removing User entity.", [user.id])
      //   store.remove("User", user.id)
      // } else {
      //   user.save()
      // }
      log.info("User no longer bonded to {}, removing Bond entity.", [bond.endpoint])
      store.remove("Bond", bond.id)
    } else {
      bond.save()
    }
  }

  const curve = registry.try_getProviderCurve(event.params.oracle, event.params.endpoint)
  const dotsIssued = bondage.try_getDotsIssued(event.params.oracle, event.params.endpoint)
  if (!curve.reverted && !dotsIssued.reverted){
    endpoint.spotPrice = getZapRequired(dotsIssued.value, BigInt.fromI32(1), getEnd(curve.value), curve.value)
    if (endpoint.spotPrice == BigInt.fromI32(0)){
      log.warning("Unable to get spotprice from {}", [endpoint.endpointStr])
    }
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
