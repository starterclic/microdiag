#!/usr/bin/env python3
"""
Microdiag Sentinel - Réparation Imprimante
==========================================
Répare les problèmes d'impression courants sous Windows.

Usage: python fix_printer.py [action]
Actions: spooler, clear, diagnose
"""

import sys
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

import subprocess
import sys
import json
import time
import os
import argparse


class PrinterFixer:
    """Réparateur d'imprimante Windows."""

    def __init__(self, verbose=False):
        self.verbose = verbose
        self.results = []

    def log(self, message: str, level: str = "info"):
        """Log avec niveau."""
        prefix = {"info": "ℹ️", "success": "✅", "warning": "⚠️", "error": "❌", "run": "🔄"}.get(level, "")
        print(f"{prefix} {message}")
        self.results.append({"level": level, "message": message})

    def run_command(self, command: str, description: str, as_admin: bool = False) -> bool:
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

    def restart_spooler(self) -> bool:
        """Redémarre le service spooler d'impression."""
        self.log("=== REDÉMARRAGE DU SPOOLER ===", "info")

        # Arrêter le spooler
        stop = self.run_command(
            "net stop spooler",
            "Arrêt du service Spooler"
        )

        time.sleep(2)

        # Démarrer le spooler
        start = self.run_command(
            "net start spooler",
            "Démarrage du service Spooler"
        )

        return stop and start

    def clear_print_queue(self) -> bool:
        """Vide la file d'attente d'impression."""
        self.log("=== VIDAGE FILE D'IMPRESSION ===", "info")

        # Arrêter le spooler
        self.run_command("net stop spooler", "Arrêt du Spooler")

        time.sleep(1)

        # Supprimer les fichiers en attente
        spool_folder = os.path.expandvars(r"%WINDIR%\System32\spool\PRINTERS")

        try:
            if os.path.exists(spool_folder):
                files_deleted = 0
                for filename in os.listdir(spool_folder):
                    file_path = os.path.join(spool_folder, filename)
                    try:
                        os.remove(file_path)
                        files_deleted += 1
                    except (PermissionError, OSError) as e:
                        self.log(f"Impossible de supprimer {filename}: {e}", "warning")

                self.log(f"Supprimé {files_deleted} fichier(s) de la file", "success")
            else:
                self.log("Dossier spool introuvable", "warning")
        except Exception as e:
            self.log(f"Erreur lors du nettoyage: {e}", "error")

        # Redémarrer le spooler
        start = self.run_command("net start spooler", "Redémarrage du Spooler")

        return start

    def list_printers(self) -> list:
        """Liste les imprimantes installées."""
        printers = []

        try:
            result = subprocess.run(
                'wmic printer get name,status,default /Format:csv',
                shell=True,
                capture_output=True,
                text=True
            )
            lines = result.stdout.strip().split('\n')[1:]  # Skip header
            for line in lines:
                parts = line.strip().split(',')
                if len(parts) >= 4:
                    printers.append({
                        "name": parts[2] if len(parts) > 2 else "Unknown",
                        "default": parts[1].upper() == "TRUE" if len(parts) > 1 else False,
                        "status": parts[3] if len(parts) > 3 else "Unknown"
                    })
        except Exception as e:
            self.log(f"Erreur lors de la liste des imprimantes: {e}", "error")

        return printers

    def diagnose(self) -> dict:
        """Diagnostic des imprimantes."""
        self.log("=== DIAGNOSTIC IMPRIMANTES ===", "info")

        diagnosis = {
            "spooler_running": False,
            "printers": [],
            "print_queue_count": 0,
            "issues": []
        }

        # Vérifier le service spooler
        self.log("Vérification du service Spooler...", "run")
        try:
            result = subprocess.run(
                'sc query spooler',
                shell=True,
                capture_output=True,
                text=True
            )
            if "RUNNING" in result.stdout.upper():
                diagnosis["spooler_running"] = True
                self.log("Service Spooler: EN COURS", "success")
            else:
                diagnosis["issues"].append("Service Spooler non actif")
                self.log("Service Spooler: ARRÊTÉ", "error")
        except Exception:
            pass

        # Lister les imprimantes
        printers = self.list_printers()
        diagnosis["printers"] = printers
        self.log(f"Imprimantes trouvées: {len(printers)}", "info")

        for printer in printers:
            status = printer.get("status", "").upper()
            name = printer.get("name", "Unknown")

            if printer.get("default"):
                self.log(f"  📌 {name} (par défaut)", "info")
            else:
                self.log(f"  🖨️  {name}", "info")

            if "ERROR" in status or "OFFLINE" in status:
                diagnosis["issues"].append(f"Imprimante '{name}' en erreur ou hors ligne")

        # Vérifier la file d'attente
        spool_folder = os.path.expandvars(r"%WINDIR%\System32\spool\PRINTERS")
        try:
            if os.path.exists(spool_folder):
                count = len([f for f in os.listdir(spool_folder) if f.endswith('.SPL')])
                diagnosis["print_queue_count"] = count
                if count > 0:
                    self.log(f"Documents en attente: {count}", "warning")
                    if count > 5:
                        diagnosis["issues"].append(f"{count} documents bloqués dans la file")
        except Exception:
            pass

        if not diagnosis["issues"]:
            self.log("Aucun problème détecté", "success")

        return diagnosis

    def full_repair(self) -> bool:
        """Réparation complète des imprimantes."""
        self.log("🔧 RÉPARATION COMPLÈTE IMPRIMANTES", "info")
        print("=" * 50)

        # 1. Diagnostic
        diag = self.diagnose()

        if not diag["issues"]:
            self.log("Tout semble fonctionner correctement", "success")
            return True

        # 2. Vider la file
        self.clear_print_queue()

        # 3. Redémarrer le spooler
        self.restart_spooler()

        # 4. Vérifier à nouveau
        time.sleep(2)
        diag_after = self.diagnose()

        if not diag_after["issues"]:
            self.log("✅ Imprimantes réparées avec succès !", "success")
            return True
        else:
            self.log("⚠️ Problèmes persistants - vérifier le câble/réseau", "warning")
            return False


def main():
    parser = argparse.ArgumentParser(description="Microdiag - Réparation imprimante")
    parser.add_argument("action", nargs="?", default="diagnose",
                        choices=["spooler", "clear", "diagnose", "full"],
                        help="Action à effectuer")
    parser.add_argument("--verbose", "-v", action="store_true", help="Affichage détaillé")
    args = parser.parse_args()

    fixer = PrinterFixer(verbose=args.verbose)

    print("=" * 50)
    print("🖨️  MICRODIAG SENTINEL - RÉPARATION IMPRIMANTE")
    print("=" * 50)

    if args.action == "spooler":
        success = fixer.restart_spooler()
    elif args.action == "clear":
        success = fixer.clear_print_queue()
    elif args.action == "full":
        success = fixer.full_repair()
    else:  # diagnose
        diag = fixer.diagnose()
        print("\n📊 RÉSULTAT DIAGNOSTIC:")
        print(json.dumps(diag, indent=2, ensure_ascii=False))
        success = len(diag["issues"]) == 0

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
