import { BigInt, Address, log, Bytes, dataSource, store } from "@graphprotocol/graph-ts"
import {
  BondCall,
  UnbondCall,
  InitializeCurveCall,
  DotTokenCreated,
  OwnershipTransferred
} from "../generated/templates/TokenDotFactory/TokenDotFactory"
import { Provider, Endpoint, User, Bond } from "../generated/schema"
import { Bondage } from "../generated/templates/TokenDotFactory/Bondage"
import { Registry } from "../generated/templates/TokenDotFactory/Registry"
import { ERC20 } from "../generated/templates/TokenDotFactory/ERC20"

// Contract addresses
let BONDADDRESS = Address.fromString("0x6164d3A0644324155cd2ad5CDDe5e01c073b79f1")
let REGADDRESS = Address.fromString("0x26BC483E8f4E868B031b29973232c188B941a3D8")

// create a new factory entity and save it.
export function handleDotTokenCreated(event: DotTokenCreated): void {
}

export function handleOwnershipTransferred(event: OwnershipTransferred): void {}

export function handleInitializeCurve(call: InitializeCurveCall): void {
  let context = dataSource.context()
  let providerId = context.getString("provider")

  let provider = Provider.load(providerId)
  if (provider == null){
    log.error("Error in loading provider: ", [call.transaction.to.toHexString()])
    return
  }

  let endpoint = Endpoint.load(call.inputs.specifier.toHex())
  if (endpoint == null){
    endpoint = new Endpoint(call.inputs.specifier.toHex())
  }

  let user = User.load(call.from.toHexString())
  if (user == null){
    user = new User(call.from.toHexString())
  }

  let bondage = Bondage.bind(BONDADDRESS)

  endpoint.provider = provider.id
  endpoint.broker = call.from.toHexString()
  endpoint.endpointStr = call.inputs.specifier.toString()
  endpoint.curve = call.inputs.curve
  endpoint.endpointBytes = call.inputs.specifier
  let dotsIssued = bondage.try_getDotsIssued(Address.fromString(provider.id), call.inputs.specifier)
  if (!dotsIssued.reverted) {
    endpoint.dotsIssued = dotsIssued.value
  } else {
    endpoint.dotsIssued = BigInt.fromI32(0)
  }
  let spotPrice = bondage.try_calcZapForDots(call.to, call.inputs.specifier, BigInt.fromI32(1))
    if (!spotPrice.reverted) {
      endpoint.spotPrice = spotPrice.value
    } else {
      log.warning("Error with getting spotprice for {}", [endpoint.endpointStr])
      return
    }
  endpoint.timestamp = call.block.timestamp
  // try to get the endpoint's Dot Limit, it's null if there is an issue getting it
  let dotLimitResult = bondage.try_dotLimit(Address.fromString(provider.id), call.inputs.specifier)
  if (dotLimitResult.reverted) {
    endpoint.dotLimit = null
    log.debug("Issue with getting dotLimit of {}", [endpoint.endpointStr])
  } else {
    endpoint.dotLimit = dotLimitResult.value
  }

  endpoint.isToken = true
  endpoint.tokenAdd = call.outputs.value0.toHexString()
  let token = ERC20.bind(call.outputs.value0)
  let symbolResult = token.try_symbol()  // try to get the token's symbol
  if (symbolResult.reverted) {
    endpoint.symbol = null
    log.debug("Issue with getting token symbol for {}", [endpoint.endpointStr])
  } else {
    endpoint.symbol = symbolResult.value
    endpoint.symbolBytes = Bytes.fromUTF8(symbolResult.value) as Bytes
  }

  provider.endpoints.push(endpoint.id)  // this endpoint was created by this provider
  user.tdfsOwned.push(provider.id)  // this provider was created by this user

  endpoint.save()
  provider.save()
  user.save()
  log.info('Added token endpoint {}', [endpoint.endpointStr])
}

export function handleBond(call: BondCall): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(call.inputs.specifier.toHex())
  if (endpoint == null) return
  let user = User.load(call.from.toHex())
  if (user == null) {
    user = new User(call.from.toHex())
  }
  let bondID = call.from.toHex() + call.inputs.specifier.toHex()
  let bond = Bond.load(bondID)
  if (bond == null) {
    bond = new Bond(bondID)
    bond.user = user.id
    bond.endpoint = endpoint.id
  }

  let bondage = Bondage.bind(BONDADDRESS)  // connection to the Bondage contract
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(call.to, call.inputs.specifier)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(call.to, call.inputs.specifier)
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
  
  let spotPrice = bondage.try_calcZapForDots(call.to, call.inputs.specifier, BigInt.fromI32(1))
  if (!spotPrice.reverted) {
    endpoint.spotPrice = spotPrice.value
    endpoint.save()
  } else {
    log.warning("Error with getting spotprice for {}", [endpoint.endpointStr])
    return
  }
}

export function handleUnbond(call: UnbondCall): void {
  // load the endpoint if it exists
  let endpoint = Endpoint.load(call.inputs.specifier.toHex())
  let user = User.load(call.from.toHex())
  let bondID = (call.from.toHex() + call.inputs.specifier.toHex())
  let bond = Bond.load(bondID)
  if (endpoint == null || bond == null || user == null) return

  let bondage = Bondage.bind(BONDADDRESS)
  let registry = Registry.bind(REGADDRESS)

  // get the number of dots issued to the endpoint
  endpoint.dotsIssued = bondage.getDotsIssued(call.to, call.inputs.specifier)

  // try to get the number of zap tokens used to bound to this endpoint
  let zapBoundResult = bondage.try_getZapBound(call.to, call.inputs.specifier)
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
  
  let spotPrice = bondage.try_calcZapForDots(call.to, call.inputs.specifier, BigInt.fromI32(1))
  if (!spotPrice.reverted) {
    endpoint.spotPrice = spotPrice.value
  } else {
    log.warning("Error with getting spotprice for {}", [endpoint.endpointStr])
    return
  }
  
  log.info("Successfully unbonded to {}.", [endpoint.endpointStr])
  endpoint.save()

}
