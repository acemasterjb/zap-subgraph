import { BigInt, Address, log, store } from "@graphprotocol/graph-ts"
import {
  Bondage,
  BondCall,
  UnbondCall,
  Escrowed,
  Released,
  Returned,
  OwnershipTransferred
} from "../generated/Bondage/Bondage"
import { Registry } from "../generated/Bondage/Registry"
import { Endpoint, User, Bond } from "../generated/schema"

// Contract Addresses
let BONDADDRESS = Address.fromString("0x6164d3A0644324155cd2ad5CDDe5e01c073b79f1")
let REGADDRESS = Address.fromString("0x26BC483E8f4E868B031b29973232c188B941a3D8")

// Updates an endpoint's dots issued and # of zap bounded
export function handleBound(call: BondCall): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(call.inputs.endpoint.toHex())
  if (endpoint == null) return
  let user = User.load(call.from.toHex())
  if (user == null) {
    user = new User(call.from.toHex())
  }
  let bondID = call.from.toHex() + call.inputs.endpoint.toHex()
  let bond = Bond.load(bondID)
  if (bond == null) {
    bond = new Bond(bondID)
    bond.user = user.id
    bond.endpoint = endpoint.id
  }

  let bondage = Bondage.bind(BONDADDRESS)  // connection to the Bondage contract
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(call.to as Address, call.inputs.endpoint)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(call.to as Address, call.inputs.endpoint)
  if (zapBoundResult.reverted) {
    // Do nothing
  } else {
    endpoint.zapBound = zapBoundResult.value
  }

  // updates the number of user-bound dots
  if (bond.bounded == BigInt.fromI32(0) || bond.bounded == null){
    bond.bounded = call.inputs.numDots
  } else {
    bond.bounded.plus(call.inputs.numDots)
  }
  bond.timestamp = call.block.timestamp
  bond.save()

  if (!user.userBound.includes(bond.id)) {
    user.userBound.push(bond.id)
  }
  log.info("Succesfully Bonded to {}.", [endpoint.endpointStr])    
  user.save()
  
  let spotPrice = bondage.try_calcZapForDots(call.to as Address, call.inputs.endpoint, BigInt.fromI32(1))
  if (!spotPrice.reverted) {
    endpoint.spotPrice = spotPrice.value
    endpoint.save()
  } else {
    log.warning("Error with getting spotprice for {}", [endpoint.endpointStr])
    return
  }
}

// Updates an endpoint's dots issued and # of zap bounded
export function handleUnbound(call: UnbondCall): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(call.inputs.endpoint.toHex())
  let user = User.load(call.from.toHex())
  let bondID = (call.from.toHex() + call.inputs.endpoint.toHex())
  let bond = Bond.load(bondID)
  if (endpoint == null || bond == null || user == null) return

  let bondage = Bondage.bind(BONDADDRESS)
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(call.to as Address, call.inputs.endpoint)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(call.to as Address, call.inputs.endpoint)
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
    bond.bounded.minus(call.inputs.numDots)
    bond.save()
  }
  
  let spotPrice = bondage.try_calcZapForDots(call.to as Address, call.inputs.endpoint, BigInt.fromI32(1))
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
