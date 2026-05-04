import Foundation
import Security

enum HelperMode: String {
  case add
  case upsert
}

enum HelperError: Error {
  case invalidArguments(String)
}

do {
  try run()
} catch let error as HelperError {
  fail(message: message(for: error), exitCode: 2)
} catch {
  fail(message: error.localizedDescription, exitCode: 1)
}

func run() throws {
  let arguments = Array(CommandLine.arguments.dropFirst())
  guard let command = arguments.first else {
    throw HelperError.invalidArguments("Expected helper command")
  }

  switch command {
  case "write-generic-password":
    let account = try readArgument(named: "--account", from: arguments)
    let service = try readArgument(named: "--service", from: arguments)
    let modeValue = try readArgument(named: "--mode", from: arguments)
    guard let mode = HelperMode(rawValue: modeValue) else {
      throw HelperError.invalidArguments("Unsupported mode: \(modeValue)")
    }

    let secret = FileHandle.standardInput.readDataToEndOfFile()
    let status = writeGenericPassword(account: account, service: service, secret: secret, mode: mode)
    guard status == errSecSuccess else {
      fail(message: message(for: status), exitCode: exitCode(for: status))
    }
  case "read-generic-password":
    let account = try readArgument(named: "--account", from: arguments)
    let service = try readArgument(named: "--service", from: arguments)
    let includeSecret = arguments.contains("--secret")
    let status = readGenericPassword(account: account, service: service, includeSecret: includeSecret)
    guard status == errSecSuccess else {
      fail(message: message(for: status), exitCode: exitCode(for: status))
    }
  case "delete-generic-password":
    let account = try readArgument(named: "--account", from: arguments)
    let service = try readArgument(named: "--service", from: arguments)
    let status = deleteGenericPassword(account: account, service: service)
    guard status == errSecSuccess else {
      fail(message: message(for: status), exitCode: exitCode(for: status))
    }
  default:
    throw HelperError.invalidArguments("Unsupported helper command: \(command)")
  }
}

func writeGenericPassword(
  account: String,
  service: String,
  secret: Data,
  mode: HelperMode,
) -> OSStatus {
  let matchQuery: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: account,
    kSecAttrService as String: service,
  ]
  let addQuery = matchQuery.merging([
    kSecValueData as String: secret,
  ]) { _, new in new }

  switch mode {
  case .add:
    return SecItemAdd(addQuery as CFDictionary, nil)
  case .upsert:
    let updateStatus = SecItemUpdate(
      matchQuery as CFDictionary,
      [kSecValueData as String: secret] as CFDictionary,
    )
    if updateStatus == errSecItemNotFound {
      return SecItemAdd(addQuery as CFDictionary, nil)
    }
    return updateStatus
  }
}

func readGenericPassword(
  account: String,
  service: String,
  includeSecret: Bool,
) -> OSStatus {
  var query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: account,
    kSecAttrService as String: service,
    kSecMatchLimit as String: kSecMatchLimitOne,
  ]

  if includeSecret {
    query[kSecReturnData as String] = true
  }

  var item: CFTypeRef?
  let status = SecItemCopyMatching(query as CFDictionary, &item)
  guard status == errSecSuccess else {
    return status
  }

  if includeSecret, let data = item as? Data {
    FileHandle.standardOutput.write(data)
  }
  return errSecSuccess
}

func deleteGenericPassword(
  account: String,
  service: String,
) -> OSStatus {
  let query: [String: Any] = [
    kSecClass as String: kSecClassGenericPassword,
    kSecAttrAccount as String: account,
    kSecAttrService as String: service,
  ]
  return SecItemDelete(query as CFDictionary)
}

func readArgument(named name: String, from arguments: [String]) throws -> String {
  guard let index = arguments.firstIndex(of: name), arguments.indices.contains(index + 1) else {
    throw HelperError.invalidArguments("Missing required argument: \(name)")
  }
  return arguments[index + 1]
}

func message(for status: OSStatus) -> String {
  if status == errSecDuplicateItem {
    return "The specified item already exists in the keychain."
  }
  if status == errSecItemNotFound {
    return "The specified item could not be found in the keychain."
  }
  if let value = SecCopyErrorMessageString(status, nil) as String? {
    return value
  }
  return "Security framework error: \(status)"
}

func message(for error: HelperError) -> String {
  switch error {
  case .invalidArguments(let detail):
    return detail
  }
}

func exitCode(for status: OSStatus) -> Int32 {
  if status == errSecDuplicateItem {
    return 45
  }
  return 1
}

func fail(message: String, exitCode: Int32) -> Never {
  FileHandle.standardError.write(Data(message.utf8))
  FileHandle.standardError.write(Data("\n".utf8))
  Foundation.exit(exitCode)
}
