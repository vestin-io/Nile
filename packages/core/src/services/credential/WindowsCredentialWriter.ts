import { spawnSync, type SpawnSyncReturns } from "node:child_process";

import type { SecurityCliResult } from "./SecurityCli";

export const WINDOWS_CREDENTIAL_BLOB_LIMIT_BYTES = 5 * 512;

export type WindowsCredentialWriteInput = {
  account: string;
  service: string;
  secret: string;
};

export type WindowsCredentialReadInput = {
  account: string;
  service: string;
  includeSecret: boolean;
};

export type WindowsCredentialDeleteInput = {
  account: string;
  service: string;
};

type SpawnSyncFn = (
  command: string,
  args: readonly string[],
  options: {
    encoding: "utf8";
    input?: string;
  },
) => SpawnSyncReturns<string>;

export class WindowsCredentialWriter {
  constructor(
    private readonly spawn: SpawnSyncFn = spawnSync,
    private readonly shellPath: string = "powershell.exe",
  ) {}

  write(input: WindowsCredentialWriteInput): SecurityCliResult {
    return this.run(
      [
        "write",
        encodeArgument(readTargetName(input.service, input.account)),
        encodeArgument(input.account),
      ],
      input.secret,
    );
  }

  read(input: WindowsCredentialReadInput): SecurityCliResult {
    return this.run([
      "read",
      encodeArgument(readTargetName(input.service, input.account)),
      input.includeSecret ? "secret" : "metadata",
    ]);
  }

  remove(input: WindowsCredentialDeleteInput): SecurityCliResult {
    return this.run([
      "delete",
      encodeArgument(readTargetName(input.service, input.account)),
    ]);
  }

  private run(argumentsList: string[], input?: string): SecurityCliResult {
    const result = this.spawn(
      this.shellPath,
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        buildPowerShellCommand(argumentsList),
      ],
      {
        encoding: "utf8",
        ...(input !== undefined ? { input } : {}),
      },
    );
    return {
      exitCode: result.status ?? 1,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
      errorMessage: result.error?.message ?? "",
    };
  }
}

function readTargetName(service: string, account: string): string {
  return `${service}/${account}`;
}

function encodeArgument(value: string): string {
  return Buffer.from(value, "utf8").toString("base64");
}

function buildPowerShellCommand(argumentsList: string[]): string {
  const serializedArgs = argumentsList
    .map((value) => `'${value}'`)
    .join(", ");

  return [
    `$arguments = @(${serializedArgs})`,
    WINDOWS_CREDENTIAL_MANAGER_SCRIPT,
    "Invoke-NileWindowsCredentialManager @arguments",
  ].join("\n");
}

const WINDOWS_CREDENTIAL_MANAGER_SCRIPT = String.raw`
function Invoke-NileWindowsCredentialManager(
  [string]$Operation,
  [string]$EncodedTargetName,
  [string]$EncodedArgument
) {
  $ErrorActionPreference = "Stop"
  Add-Type -TypeDefinition @"
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;

public static class NileWindowsCredentialManager {
  private const int CRED_TYPE_GENERIC = 1;
  private const int CRED_PERSIST_LOCAL_MACHINE = 2;
  private const int CRED_MAX_CREDENTIAL_BLOB_SIZE = ${WINDOWS_CREDENTIAL_BLOB_LIMIT_BYTES};

  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct CREDENTIAL {
    public UInt32 Flags;
    public UInt32 Type;
    public string TargetName;
    public string Comment;
    public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
    public UInt32 CredentialBlobSize;
    public IntPtr CredentialBlob;
    public UInt32 Persist;
    public UInt32 AttributeCount;
    public IntPtr Attributes;
    public string TargetAlias;
    public string UserName;
  }

  [DllImport("Advapi32.dll", EntryPoint = "CredWriteW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredWrite(ref CREDENTIAL userCredential, UInt32 flags);

  [DllImport("Advapi32.dll", EntryPoint = "CredReadW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredRead(string target, UInt32 type, UInt32 flags, out IntPtr credentialPtr);

  [DllImport("Advapi32.dll", EntryPoint = "CredDeleteW", CharSet = CharSet.Unicode, SetLastError = true)]
  private static extern bool CredDelete(string target, UInt32 type, UInt32 flags);

  [DllImport("Advapi32.dll", SetLastError = true)]
  private static extern void CredFree([In] IntPtr cred);

  public static void Write(string targetName, string userName, string secret) {
    byte[] secretBytes = Encoding.Unicode.GetBytes(secret ?? string.Empty);
    if (secretBytes.Length > CRED_MAX_CREDENTIAL_BLOB_SIZE) {
      throw new Win32Exception(1783, "Credential payload exceeds the Windows Credential Manager size limit.");
    }

    IntPtr credentialBlob = IntPtr.Zero;
    try {
      credentialBlob = Marshal.AllocCoTaskMem(secretBytes.Length);
      if (secretBytes.Length > 0) {
        Marshal.Copy(secretBytes, 0, credentialBlob, secretBytes.Length);
      }

      CREDENTIAL credential = new CREDENTIAL {
        Type = CRED_TYPE_GENERIC,
        TargetName = targetName,
        UserName = userName,
        CredentialBlobSize = (UInt32)secretBytes.Length,
        CredentialBlob = credentialBlob,
        Persist = CRED_PERSIST_LOCAL_MACHINE
      };

      if (!CredWrite(ref credential, 0)) {
        throw new Win32Exception(Marshal.GetLastWin32Error());
      }
    } finally {
      if (credentialBlob != IntPtr.Zero) {
        for (int i = 0; i < secretBytes.Length; i++) {
          Marshal.WriteByte(credentialBlob, i, 0);
        }
        Marshal.FreeCoTaskMem(credentialBlob);
      }
    }
  }

  public static string Read(string targetName, bool includeSecret) {
    IntPtr credentialPtr;
    if (!CredRead(targetName, CRED_TYPE_GENERIC, 0, out credentialPtr)) {
      throw new Win32Exception(Marshal.GetLastWin32Error());
    }

    try {
      CREDENTIAL credential = (CREDENTIAL)Marshal.PtrToStructure(credentialPtr, typeof(CREDENTIAL));
      if (!includeSecret || credential.CredentialBlob == IntPtr.Zero || credential.CredentialBlobSize == 0) {
        return credential.UserName ?? string.Empty;
      }

      byte[] secretBytes = new byte[credential.CredentialBlobSize];
      Marshal.Copy(credential.CredentialBlob, secretBytes, 0, (int)credential.CredentialBlobSize);
      return Encoding.Unicode.GetString(secretBytes);
    } finally {
      CredFree(credentialPtr);
    }
  }

  public static void Delete(string targetName) {
    if (!CredDelete(targetName, CRED_TYPE_GENERIC, 0)) {
      throw new Win32Exception(Marshal.GetLastWin32Error());
    }
  }
}
"@

  $targetName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EncodedTargetName))

  try {
    if ($Operation -eq "write") {
      $userName = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($EncodedArgument))
      $secret = [Console]::In.ReadToEnd()
      [NileWindowsCredentialManager]::Write($targetName, $userName, $secret)
      return
    }

    if ($Operation -eq "read") {
      $includeSecret = $EncodedArgument -eq "secret"
      $value = [NileWindowsCredentialManager]::Read($targetName, $includeSecret)
      [Console]::Out.Write($value)
      return
    }

    if ($Operation -eq "delete") {
      [NileWindowsCredentialManager]::Delete($targetName)
      return
    }

    throw "Unsupported operation: $Operation"
  } catch [System.ComponentModel.Win32Exception] {
    [Console]::Error.Write("Win32 $($_.Exception.NativeErrorCode): $($_.Exception.Message)")
    exit 1
  }
}
`;
