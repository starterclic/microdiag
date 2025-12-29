#!/usr/bin/env python3
"""
Microdiag Sentinel - Script de Réparation Réseau
=================================================
Répare les problèmes réseau courants (WiFi, DNS, DHCP).

Usage: python fix_network.py [action]
Actions: wifi, dns, dhcp, full, diagnose
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import subprocess
import sys
import json
import time
import socket
import argparse
from typing import Dict, Any


class NetworkFixer:
    """Réparateur réseau Windows."""

    def __init__(self, verbose=False):
        self.verbose = verbose
        self.results = []

    def log(self, message: str, level: str = "info"):
        """Log avec niveau."""
        if self.verbose or level in ["error", "success"]:
            prefix = {"info": "ℹ️", "success": "✅", "warning": "⚠️", "error": "❌", "run": "🔄"}.get(level, "")
            print(f"{prefix} {message}")
        self.results.append({"level": level, "message": message})

    def run_command(self, command: str, description: str) -> bool:
        """Exécute une commande système."""
        self.log(f"{description}...", "run")
        try:
            result = subprocess.run(
                command,
                shell=True,
                capture_output=True,
                text=True,
                timeout=30
            )
            if result.returncode == 0:
                self.log(f"{description} - OK", "success")
                return True
            else:
                self.log(f"{description} - Erreur: {result.stderr.strip()}", "error")
                return False
        except subprocess.TimeoutExpired:
            self.log(f"{description} - Timeout", "error")
            return False
        except Exception as e:
            self.log(f"{description} - Exception: {e}", "error")
            return False

    def flush_dns(self) -> bool:
        """Vide le cache DNS."""
        self.log("=== FLUSH DNS ===", "info")
        return self.run_command(
            "ipconfig /flushdns",
            "Vidage du cache DNS"
        )

    def renew_dhcp(self) -> bool:
        """Renouvelle le bail DHCP."""
        self.log("=== RENOUVELLEMENT DHCP ===", "info")

        # Release
        release = self.run_command(
            "ipconfig /release",
            "Libération du bail DHCP"
        )

        time.sleep(2)

        # Renew
        renew = self.run_command(
            "ipconfig /renew",
            "Renouvellement du bail DHCP"
        )

        return release and renew

    def reset_winsock(self) -> bool:
        """Réinitialise le catalogue Winsock."""
        self.log("=== RESET WINSOCK ===", "info")
        return self.run_command(
            "netsh winsock reset",
            "Réinitialisation Winsock (redémarrage recommandé)"
        )

    def reset_tcp_ip(self) -> bool:
        """Réinitialise la stack TCP/IP."""
        self.log("=== RESET TCP/IP ===", "info")
        results = []
        results.append(self.run_command(
            "netsh int ip reset",
            "Réinitialisation TCP/IP"
        ))
        results.append(self.run_command(
            "netsh int ipv6 reset",
            "Réinitialisation IPv6"
        ))
        return all(results)

    def reset_wifi_adapter(self) -> bool:
        """Réinitialise l'adaptateur WiFi."""
        self.log("=== RESET ADAPTATEUR WIFI ===", "info")

        # Trouver l'adaptateur WiFi
        try:
            result = subprocess.run(
                'netsh wlan show interfaces',
                shell=True,
                capture_output=True,
                text=True
            )
            if "Wi-Fi" not in result.stdout and "Wireless" not in result.stdout:
                self.log("Aucun adaptateur WiFi trouvé", "warning")
                return False
        except Exception:
            pass

        # Désactiver puis réactiver
        disable = self.run_command(
            'netsh interface set interface "Wi-Fi" disable',
            "Désactivation de l'adaptateur WiFi"
        )

        time.sleep(3)

        enable = self.run_command(
            'netsh interface set interface "Wi-Fi" enable',
            "Réactivation de l'adaptateur WiFi"
        )

        return disable and enable

    def set_google_dns(self) -> bool:
        """Configure les DNS Google."""
        self.log("=== CONFIGURATION DNS GOOGLE ===", "info")

        # Trouver l'interface active
        interfaces = ["Wi-Fi", "Ethernet", "Connexion au réseau local"]

        for interface in interfaces:
            result1 = self.run_command(
                f'netsh interface ip set dns "{interface}" static 8.8.8.8 primary',
                f"Configuration DNS primaire sur {interface}"
            )
            if result1:
                self.run_command(
                    f'netsh interface ip add dns "{interface}" 8.8.4.4 index=2',
                    f"Configuration DNS secondaire sur {interface}"
                )
                return True

        return False

    def diagnose(self) -> Dict[str, Any]:
        """Diagnostic réseau complet."""
        self.log("=== DIAGNOSTIC RÉSEAU ===", "info")

        diagnosis = {
            "internet": False,
            "dns": False,
            "gateway": False,
            "local_ip": None,
            "issues": []
        }

        # Test connexion internet
        self.log("Test connexion internet...", "run")
        try:
            socket.create_connection(("8.8.8.8", 53), timeout=3)
            diagnosis["internet"] = True
            self.log("Connexion internet: OK", "success")
        except (socket.timeout, OSError):
            diagnosis["issues"].append("Pas de connexion internet")
            self.log("Connexion internet: ÉCHEC", "error")

        # Test DNS
        self.log("Test résolution DNS...", "run")
        try:
            socket.gethostbyname("google.com")
            diagnosis["dns"] = True
            self.log("Résolution DNS: OK", "success")
        except socket.gaierror:
            diagnosis["issues"].append("Résolution DNS échouée")
            self.log("Résolution DNS: ÉCHEC", "error")

        # Récupérer l'IP locale
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
            s.connect(("8.8.8.8", 80))
            diagnosis["local_ip"] = s.getsockname()[0]
            s.close()
            self.log(f"IP locale: {diagnosis['local_ip']}", "success")
        except Exception:
            diagnosis["issues"].append("Impossible de déterminer l'IP locale")

        # Test passerelle
        self.log("Test passerelle...", "run")
        try:
            result = subprocess.run(
                'route print 0.0.0.0',
                shell=True,
                capture_output=True,
                text=True
            )
            if "0.0.0.0" in result.stdout:
                diagnosis["gateway"] = True
                self.log("Passerelle: OK", "success")
            else:
                diagnosis["issues"].append("Pas de passerelle par défaut")
                self.log("Passerelle: NON CONFIGURÉE", "error")
        except Exception:
            pass

        return diagnosis

    def full_repair(self) -> bool:
        """Réparation complète du réseau."""
        self.log("🔧 RÉPARATION RÉSEAU COMPLÈTE", "info")
        print("=" * 50)

        results = []

        # 1. Diagnostic initial
        diag = self.diagnose()

        if diag["internet"] and diag["dns"]:
            self.log("Le réseau semble fonctionner correctement", "success")
            return True

        # 2. Flush DNS
        results.append(self.flush_dns())

        # 3. Reset WiFi si problème
        if not diag["internet"]:
            results.append(self.reset_wifi_adapter())
            time.sleep(5)

        # 4. Renouveler DHCP
        results.append(self.renew_dhcp())
        time.sleep(3)

        # 5. Vérifier à nouveau
        diag_after = self.diagnose()

        if diag_after["internet"]:
            self.log("✅ Réseau réparé avec succès !", "success")
            return True
        else:
            self.log("⚠️ Problème persistant - Essayer reset Winsock + redémarrage", "warning")
            return False


def main():
    parser = argparse.ArgumentParser(description="Microdiag - Réparation réseau")
    parser.add_argument("action", nargs="?", default="diagnose",
                        choices=["wifi", "dns", "dhcp", "full", "diagnose"],
                        help="Action à effectuer")
    parser.add_argument("--verbose", "-v", action="store_true", help="Affichage détaillé")
    args = parser.parse_args()

    fixer = NetworkFixer(verbose=args.verbose)

    print("=" * 50)
    print("🌐 MICRODIAG SENTINEL - RÉPARATION RÉSEAU")
    print("=" * 50)

    if args.action == "wifi":
        success = fixer.reset_wifi_adapter()
    elif args.action == "dns":
        success = fixer.flush_dns()
    elif args.action == "dhcp":
        success = fixer.renew_dhcp()
    elif args.action == "full":
        success = fixer.full_repair()
    else:  # diagnose
        diag = fixer.diagnose()
        print("\n📊 RÉSULTAT DIAGNOSTIC:")
        print(json.dumps(diag, indent=2))
        success = diag["internet"] and diag["dns"]

    print("\n" + "=" * 50)

    result = {
        "success": success,
        "action": args.action,
        "logs": fixer.results
    }
    print(json.dumps(result))

    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
