param([string]$VideoPath,[string]$OutputPath)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$storageType=[Windows.Storage.StorageFile,Windows.Storage,ContentType=WindowsRuntime]
$folderType=[Windows.Storage.StorageFolder,Windows.Storage,ContentType=WindowsRuntime]
$clipType=[Windows.Media.Editing.MediaClip,Windows.Media.Editing,ContentType=WindowsRuntime]
$compType=[Windows.Media.Editing.MediaComposition,Windows.Media.Editing,ContentType=WindowsRuntime]
$profileType=[Windows.Media.MediaProperties.MediaEncodingProfile,Windows.Media.MediaProperties,ContentType=WindowsRuntime]
$qualityType=[Windows.Media.MediaProperties.AudioEncodingQuality,Windows.Media.MediaProperties,ContentType=WindowsRuntime]
$trimType=[Windows.Media.Editing.MediaTrimmingPreference,Windows.Media.Editing,ContentType=WindowsRuntime]
$failType=[Windows.Media.Transcoding.TranscodeFailureReason,Windows.Media.Transcoding,ContentType=WindowsRuntime]
$collisionType=[Windows.Storage.CreationCollisionOption,Windows.Storage,ContentType=WindowsRuntime]
$asTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 1 -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'} | Select-Object -First 1
function Await-Op($op,[Type]$type){$t=$asTask.MakeGenericMethod($type).Invoke($null,@($op));$t.Wait();return $t.Result}
$source=Await-Op ($storageType::GetFileFromPathAsync((Resolve-Path -LiteralPath $VideoPath).Path)) $storageType
$clip=Await-Op ($clipType::CreateFromFileAsync($source)) $clipType
$clip.TrimTimeFromStart=[TimeSpan]::FromSeconds(24)
$clip.TrimTimeFromEnd=[TimeSpan]::FromSeconds($clip.OriginalDuration.TotalSeconds-33.5)
$comp=New-Object $compType
$ct=[System.Collections.Generic.ICollection``1].MakeGenericType($clipType)
$ct.GetMethod('Add').Invoke($comp.Clips,@($clip)) | Out-Null
$full=[System.IO.Path]::GetFullPath($OutputPath)
$folder=Await-Op ($folderType::GetFolderFromPathAsync([System.IO.Path]::GetDirectoryName($full))) $folderType
$file=Await-Op ($folder.CreateFileAsync([System.IO.Path]::GetFileName($full),$collisionType::ReplaceExisting)) $storageType
$profile=$profileType::CreateM4a($qualityType::High)
$operation=$comp.RenderToFileAsync($file,$trimType::Precise,$profile)
$progressTask=[System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {$_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetGenericArguments().Count -eq 2 -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperationWithProgress`2'} | Select-Object -First 1
$task=$progressTask.MakeGenericMethod($failType,[double]).Invoke($null,@($operation))
$task.Wait()
Write-Output ('Render result: '+$task.Result)
if($task.Result.ToString() -ne 'None'){throw 'Audio export failed'}
Write-Output $full

