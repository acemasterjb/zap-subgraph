import { BigInt, Address, log, Bytes, dataSource } from "@graphprotocol/graph-ts"
import {
  InitializeCurveCall,
  // TokenDotFactory,
  DotTokenCreated,
  OwnershipTransferred
} from "../generated/templates/TokenDotFactory/TokenDotFactory"
import { Provider, Endpoint } from "../generated/schema"
// import { Registry } from "../../providers-kovan/generated/Registry/Registry"
import { Bondage } from "../generated/templates/TokenDotFactory/Bondage"
import { ERC20 } from "../generated/templates/TokenDotFactory/ERC20"

// Contract addresses
let BONDADDRESS = Address.fromString("0x188f79B0a8EdC10aD53285c47c3fEAa0D2716e83")

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

  provider.endpoints.push(endpoint.id)

  endpoint.save()
  provider.save()
  log.info('Added token endpoint {}', [endpoint.endpointStr])
}
