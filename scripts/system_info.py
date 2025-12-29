#!/usr/bin/env python3
"""
Microdiag Sentinel - Collecteur d'Informations Système
=======================================================
Récupère les métriques système pour le monitoring.

Usage: python system_info.py [--json] [--watch]
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import os
import sys
import json
import platform
import socket
import argparse
import time
from datetime import datetime

# Essayer d'importer psutil, sinon utiliser les alternatives Windows
try:
    import psutil
    HAS_PSUTIL = True
except ImportError:
    HAS_PSUTIL = False
    import subprocess
    import ctypes


class SystemInfo:
    """Collecteur d'informations système."""

    def __init__(self):
        self.hostname = socket.gethostname()
        self.os_type = platform.system().lower()
        self.os_version = platform.version()

    def get_cpu_usage(self) -> float:
        """Usage CPU en pourcentage."""
        if HAS_PSUTIL:
            return psutil.cpu_percent(interval=1)

        # Alternative Windows sans psutil
        try:
            result = subprocess.run(
                'wmic cpu get loadpercentage',
                shell=True,
                capture_output=True,
                text=True
            )
            lines = result.stdout.strip().split('\n')
            if len(lines) >= 2:
                return float(lines[1].strip())
        except Exception:
            pass
        return 0.0

    def get_memory_info(self) -> dict:
        """Informations mémoire."""
        if HAS_PSUTIL:
            mem = psutil.virtual_memory()
            return {
                "total_gb": round(mem.total / (1024**3), 2),
                "available_gb": round(mem.available / (1024**3), 2),
                "used_gb": round(mem.used / (1024**3), 2),
                "percent": mem.percent
            }

        # Alternative Windows
        try:
            result = subprocess.run(
                'wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /Value',
                shell=True,
                capture_output=True,
                text=True
            )
            lines = result.stdout.strip().split('\n')
            values = {}
            for line in lines:
                if '=' in line:
                    key, val = line.strip().split('=')
                    values[key] = int(val) if val.isdigit() else 0

            total = values.get('TotalVisibleMemorySize', 0) * 1024  # KB to bytes
            free = values.get('FreePhysicalMemory', 0) * 1024
            used = total - free
            percent = (used / total * 100) if total > 0 else 0

            return {
                "total_gb": round(total / (1024**3), 2),
                "available_gb": round(free / (1024**3), 2),
                "used_gb": round(used / (1024**3), 2),
                "percent": round(percent, 1)
            }
        except Exception:
            return {"total_gb": 0, "available_gb": 0, "used_gb": 0, "percent": 0}

    def get_disk_info(self) -> list:
        """Informations disques."""
        disks = []

        if HAS_PSUTIL:
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    disks.append({
                        "device": partition.device,
                        "mountpoint": partition.mountpoint,
                        "fstype": partition.fstype,
                        "total_gb": round(usage.total / (1024**3), 2),
                        "used_gb": round(usage.used / (1024**3), 2),
                        "free_gb": round(usage.free / (1024**3), 2),
                        "percent": usage.percent
                    })
                except (PermissionError, OSError):
                    pass
            return disks

        # Alternative Windows
        try:
            result = subprocess.run(
                'wmic logicaldisk get caption,freespace,size /Format:csv',
                shell=True,
                capture_output=True,
                text=True
            )
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            for line in lines:
                parts = line.strip().split(',')
                if len(parts) >= 4 and parts[2] and parts[3]:
                    try:
                        free = int(parts[2])
                        total = int(parts[3])
                        used = total - free
                        percent = (used / total * 100) if total > 0 else 0
                        disks.append({
                            "device": parts[1],
                            "mountpoint": parts[1],
                            "fstype": "NTFS",
                            "total_gb": round(total / (1024**3), 2),
                            "used_gb": round(used / (1024**3), 2),
                            "free_gb": round(free / (1024**3), 2),
                            "percent": round(percent, 1)
                        })
                    except (ValueError, IndexError):
                        pass
        except Exception:
            pass

        return disks

    def get_network_info(self) -> dict:
        """Informations réseau."""
        info = {
            "hostname": self.hostname,
            "ip_addresses": []
        }

        try:
            # IP locale
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            info["local_ip"] = s.getsockname()[0]
            s.close()
        except Exception:
            info["local_ip"] = "Unknown"

        if HAS_PSUTIL:
            for interface, addrs in psutil.net_if_addrs().items():
                for addr in addrs:
                    if addr.family == socket.AF_INET:
                        info["ip_addresses"].append({
                            "interface": interface,
                            "ip": addr.address
                        })

        return info

    def get_security_status(self) -> dict:
        """Statut sécurité Windows (Antivirus, Firewall)."""
        status = {
            "antivirus": "unknown",
            "firewall": "unknown",
            "windows_update": "unknown"
        }

        if self.os_type != "windows":
            return status

        try:
            # Windows Security Center
            result = subprocess.run(
                'powershell -Command "Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,FirewallEnabled | ConvertTo-Json"',
                shell=True,
                capture_output=True,
                text=True,
                timeout=10
            )
            if result.returncode == 0:
                data = json.loads(result.stdout)
                status["antivirus"] = "active" if data.get("AntivirusEnabled") else "inactive"
                status["realtime_protection"] = "active" if data.get("RealTimeProtectionEnabled") else "inactive"
        except Exception:
            pass

        try:
            # Firewall
            result = subprocess.run(
                'netsh advfirewall show allprofiles state',
                shell=True,
                capture_output=True,
                text=True,
                timeout=5
            )
            if "ON" in result.stdout.upper():
                status["firewall"] = "active"
            else:
                status["firewall"] = "inactive"
        except Exception:
            pass

        return status

    def get_uptime(self) -> dict:
        """Temps de fonctionnement."""
        if HAS_PSUTIL:
            boot_time = datetime.fromtimestamp(psutil.boot_time())
            uptime = datetime.now() - boot_time
            return {
                "boot_time": boot_time.isoformat(),
                "uptime_seconds": int(uptime.total_seconds()),
                "uptime_readable": str(uptime).split('.')[0]
            }

        # Alternative Windows
        try:
            result = subprocess.run(
                'net stats srv',
                shell=True,
                capture_output=True,
                text=True
            )
            # Parser la sortie pour trouver "Statistics since"
            for line in result.stdout.split('\n'):
                if 'since' in line.lower() or 'depuis' in line.lower():
                    return {"uptime_readable": line.strip()}
        except Exception:
            pass

        return {"uptime_readable": "Unknown"}

    def get_processes_count(self) -> int:
        """Nombre de processus."""
        if HAS_PSUTIL:
            return len(psutil.pids())

        try:
            result = subprocess.run(
                'tasklist /NH',
                shell=True,
                capture_output=True,
                text=True
            )
            return len([l for l in result.stdout.split('\n') if l.strip()])
        except Exception:
            return 0

    def collect_all(self) -> dict:
        """Collecte toutes les informations."""
        return {
            "timestamp": datetime.now().isoformat(),
            "hostname": self.hostname,
            "os": {
                "type": self.os_type,
                "version": self.os_version,
                "platform": platform.platform()
            },
            "cpu": {
                "usage_percent": self.get_cpu_usage(),
                "cores": os.cpu_count()
            },
            "memory": self.get_memory_info(),
            "disks": self.get_disk_info(),
            "network": self.get_network_info(),
            "security": self.get_security_status(),
            "uptime": self.get_uptime(),
            "processes_count": self.get_processes_count()
        }

    def get_health_score(self) -> dict:
        """Calcule un score de santé global."""
        data = self.collect_all()
        score = 100
        issues = []

        # CPU > 80% = warning
        if data["cpu"]["usage_percent"] > 80:
            score -= 15
            issues.append("CPU élevé")

        # RAM > 85% = warning
        if data["memory"]["percent"] > 85:
            score -= 20
            issues.append("Mémoire faible")

        # Disque > 90% = critical
        for disk in data["disks"]:
            if disk["percent"] > 90:
                score -= 25
                issues.append(f"Disque {disk['device']} presque plein")

        # Sécurité
        if data["security"]["antivirus"] != "active":
            score -= 15
            issues.append("Antivirus inactif")
        if data["security"]["firewall"] != "active":
            score -= 10
            issues.append("Pare-feu inactif")

        status = "healthy" if score >= 80 else "warning" if score >= 50 else "critical"

        return {
            "score": max(0, score),
            "status": status,
            "issues": issues
        }


def main():
    parser = argparse.ArgumentParser(description="Microdiag - Infos système")
    parser.add_argument("--json", action="store_true", help="Sortie JSON uniquement")
    parser.add_argument("--watch", action="store_true", help="Mode surveillance continu")
    parser.add_argument("--interval", type=int, default=60, help="Intervalle en secondes (avec --watch)")
    args = parser.parse_args()

    info = SystemInfo()

    if args.watch:
        print("Mode surveillance activé. Ctrl+C pour arrêter.\n")
        try:
            while True:
                data = info.collect_all()
                health = info.get_health_score()
                data["health"] = health

                if args.json:
                    print(json.dumps(data))
                else:
                    print(f"[{data['timestamp']}] CPU: {data['cpu']['usage_percent']}% | "
                          f"RAM: {data['memory']['percent']}% | "
                          f"Score: {health['score']}/100 ({health['status']})")

                time.sleep(args.interval)
        except KeyboardInterrupt:
            print("\nArrêt de la surveillance.")
            return 0

    # Mode normal
    data = info.collect_all()
    health = info.get_health_score()
    data["health"] = health

    if args.json:
        print(json.dumps(data, indent=2))
    else:
        print("=" * 50)
        print("🖥️  MICRODIAG SENTINEL - INFORMATIONS SYSTÈME")
        print("=" * 50)
        print(f"\n📌 Hôte: {data['hostname']}")
        print(f"🖥️  OS: {data['os']['platform']}")
        print(f"⏱️  Uptime: {data['uptime'].get('uptime_readable', 'N/A')}")
        print(f"\n📊 CPU: {data['cpu']['usage_percent']}% ({data['cpu']['cores']} cores)")
        print(f"🧠 RAM: {data['memory']['used_gb']} / {data['memory']['total_gb']} GB ({data['memory']['percent']}%)")

        print("\n💾 Disques:")
        for disk in data['disks']:
            bar = "█" * int(disk['percent'] / 10) + "░" * (10 - int(disk['percent'] / 10))
            print(f"   {disk['device']}: [{bar}] {disk['percent']}% ({disk['free_gb']} GB libres)")

        print(f"\n🔒 Sécurité:")
        print(f"   Antivirus: {data['security']['antivirus']}")
        print(f"   Pare-feu: {data['security']['firewall']}")

        print(f"\n❤️  Score Santé: {health['score']}/100 ({health['status'].upper()})")
        if health['issues']:
            print(f"   ⚠️  Problèmes: {', '.join(health['issues'])}")

        print("\n" + "=" * 50)

    return 0


if __name__ == "__main__":
    sys.exit(main())
