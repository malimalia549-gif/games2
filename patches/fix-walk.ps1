$path = Join-Path (Get-Location) "src\components\VillageGround.tsx"
if (-not (Test-Path $path)) { throw "File tidak ketemu: $path" }
$script:c = [System.IO.File]::ReadAllText($path)
$nl = "`n"
if ($script:c.Contains("`r`n")) { $nl = "`r`n" }
$script:c = $script:c.Replace("`r`n", "`n")

function Rep([string]$old, [string]$new) {
  if (-not $script:c.Contains($old)) {
    $preview = $old.Substring(0, [Math]::Min(80, $old.Length))
    throw "Potongan tidak ketemu. Restore file dulu. Awal: $preview"
  }
  $script:c = $script:c.Replace($old, $new)
}

$a = @'
  const bobY = player.moving ? Math.round(-Math.abs(Math.cos(phi)) * 1.2) : idleBreath;
  const hairBounceY = player.moving ? Math.round(-Math.abs(Math.cos(phi - 0.55)) * 1.0) : 0;
'@
$b = @'
  // Slightly stronger bob on vertical walks so up/down feels as lively as left/right
  const bobAmp = player.dir === "up" || player.dir === "down" ? 1.7 : 1.2;
  const bobY = player.moving ? Math.round(-Math.abs(Math.cos(phi)) * bobAmp) : idleBreath;
  const hairBounceY = player.moving ? Math.round(-Math.abs(Math.cos(phi - 0.55)) * (bobAmp > 1.2 ? 1.35 : 1.0)) : 0;
'@
Rep $a.TrimEnd() $b.TrimEnd()

$a = @'
      const thetaUpper = s * 0.42 + side * 0.22;
      const elbowX = shX + Math.sin(thetaUpper) * 5.6;
      const elbowY = shY + Math.cos(thetaUpper) * 5.6;

      const thetaFore = s * 0.56 + side * 0.14;
      const wristX = elbowX + Math.sin(thetaFore) * 5.2;
      const wristY = elbowY + Math.cos(thetaFore) * 5.2;
'@
$b = @'
      // Stronger pendulum (closer to side-view energy) while keeping constant arm length
      const thetaUpper = s * 0.62 + side * 0.18;
      const elbowX = shX + Math.sin(thetaUpper) * 5.8;
      const elbowY = shY + Math.cos(thetaUpper) * 5.8;

      const thetaFore = s * 0.72 + side * 0.12;
      const wristX = elbowX + Math.sin(thetaFore) * 5.4;
      const wristY = elbowY + Math.cos(thetaFore) * 5.4;
'@
Rep $a.TrimEnd() $b.TrimEnd()

$a = @'
      const hipX = side * 3.1 + swayX * 0.4;
      const hipY = -16.0 + bobY;
      // Pendulum knee & ankle movement with natural passing lift
      const thetaLeg = s * 0.22 + side * (0.04 + lift * 0.08);
      const kneeX = hipX + Math.sin(thetaLeg) * 6.8;
      const kneeY = hipY + Math.cos(thetaLeg) * 6.8 - lift * 1.6;
      const ankleX = side * 3.1 + Math.sin(thetaLeg) * 2.2;
      const ankleY = kneeY + 6.8 - lift * 2.2 + s * 1.2;
'@
$b = @'
      const hipX = side * 3.2 + swayX * 0.45;
      const hipY = -16.0 + bobY;
      // Wider thigh swing (was 0.22). Closer to side-view, adapted for front/back.
      const thetaThigh = s * 0.58 + Math.max(0, lift) * 0.22 + side * 0.03;
      const L1 = 7.4;
      const kneeX = hipX + Math.sin(thetaThigh) * L1 * 0.55;
      const kneeY = hipY + Math.cos(thetaThigh) * L1 - lift * 2.4;
      const kneeBend = player.moving
        ? Math.max(0, Math.cos(legPhi - 0.28)) * 0.85 + (s < 0 ? -s * 0.12 : 0)
        : 0.04;
      const thetaCalf = thetaThigh - kneeBend;
      const L2 = 7.2;
      const ankleX = kneeX + Math.sin(thetaCalf) * (isUp ? -0.8 : 0.8) * Math.abs(s);
      const ankleY = Math.min(-1.2, kneeY + Math.cos(thetaCalf) * L2 - lift * 1.8);
'@
Rep $a.TrimEnd() $b.TrimEnd()

$a = @'
      if (lift > 0.45) {
'@
$b = @'
      if (lift > 0.35) {
'@
Rep $a.TrimEnd() $b.TrimEnd()

$a = @'
          const candX = Math.max(48, Math.min(WIDTH - 48, player.x + nx * walkSpeed * dt));
          const candY = Math.max(56, Math.min(HEIGHT - 48, player.y + ny * walkSpeed * dt));
          if (cellVal(Math.round(candX) >> 2, Math.round(candY) >> 2) !== 3) {
            player.x = candX;
            player.y = candY;
          }
          // Project a smooth stride target 36px ahead so tapping or holding keys animates legs with the exact same smooth continuity as mouse-click!
          const aheadX = Math.max(48, Math.min(WIDTH - 48, player.x + nx * 36));
          const aheadY = Math.max(56, Math.min(HEIGHT - 48, player.y + ny * 36));
          if (cellVal(Math.round(aheadX) >> 2, Math.round(aheadY) >> 2) !== 3) {
'@
$b = @'
          const step = walkSpeed * dt;
          // Axis-separated collision so vertical walking slides along obstacles.
          const candX = Math.max(48, Math.min(WIDTH - 48, player.x + nx * step));
          const candY = Math.max(56, Math.min(HEIGHT - 48, player.y + ny * step));
          const footCell = (px: number, py: number) =>
            cellVal(Math.round(px) >> 2, Math.round(py) >> 2);
          if (footCell(candX, player.y) !== 3) {
            player.x = candX;
          }
          if (footCell(player.x, candY) !== 3) {
            player.y = candY;
          }
          // Project a smooth stride target 36px ahead so tapping or holding keys animates legs with the exact same smooth continuity as mouse-click!
          const aheadX = Math.max(48, Math.min(WIDTH - 48, player.x + nx * 36));
          const aheadY = Math.max(56, Math.min(HEIGHT - 48, player.y + ny * 36));
          if (footCell(aheadX, aheadY) !== 3) {
'@
Rep $a.TrimEnd() $b.TrimEnd()

if ($nl -eq "`r`n") { $script:c = $script:c.Replace("`n", "`r`n") }
$utf8 = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::WriteAllText($path, $script:c, $utf8)
Write-Host "SELESAI. bobAmp=$($script:c.Contains('bobAmp')) thetaThigh=$($script:c.Contains('thetaThigh')) footCell=$($script:c.Contains('footCell'))"
