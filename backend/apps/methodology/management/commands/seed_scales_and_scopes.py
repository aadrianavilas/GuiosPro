from django.core.management.base import BaseCommand
from django.db import transaction

from apps.methodology.models.scale import Scale, ScaleLevel
from apps.methodology.models.scope import Scope


class Command(BaseCommand):
    help = "Registra en la base de datos las escalas de Factor y Subfactor (con sus ScaleLevels) y los alcances en Scope (Interno y Externo)"

    def add_arguments(self, parser):
        parser.add_argument(
            "--clean",
            action="store_true",
            help="Elimina las escalas, niveles y scopes existentes antes de crearlos nuevamente",
        )

    def handle(self, *args, **options):
        clean = options.get("clean", False)

        self.stdout.write(self.style.MIGRATE_HEADING("==> Inicializando Escalas, Niveles (ScaleLevel) y Alcances (Scope)..."))

        with transaction.atomic():
            if clean:
                self.stdout.write(self.style.WARNING("Limpiando ScaleLevel, Scale y Scope previos..."))
                ScaleLevel.objects.all().delete()
                Scale.objects.all().delete()
                Scope.objects.all().delete()

            # ─────────────────────────────────────────────────────────────
            # 1. ESCALA DE FACTOR (en tabla Scale)
            # ─────────────────────────────────────────────────────────────
            scale_factor, created_sf = Scale.objects.update_or_create(
                name="Factor",
                defaults={
                    "description": "Escala de importancia para el Factor (1: Irrelevante, 2: Opcional, 3: Importante, 4: Fundamental)",
                    "is_active": True,
                },
            )
            action_sf = "Creada" if created_sf else "Actualizada"
            self.stdout.write(f"• Escala '{scale_factor.name}': {action_sf} (ID: {scale_factor.id})")

            factor_levels = [
                (1, "Irrelevante", 1),
                (2, "Opcional", 2),
                (3, "Importante", 3),
                (4, "Fundamental", 4),
            ]

            for val, label, order in factor_levels:
                lvl_obj, created_lvl = ScaleLevel.objects.update_or_create(
                    scale=scale_factor,
                    label=label,
                    defaults={
                        "value": val,
                        "order": order,
                        "is_active": True,
                    },
                )
                act = "Creado" if created_lvl else "Actualizado"
                self.stdout.write(f"   ↳ [ScaleLevel Factor] {val} - {label} ({act})")

            # ─────────────────────────────────────────────────────────────
            # 2. ESCALA DE SUBFACTOR (en tabla Scale)
            # ─────────────────────────────────────────────────────────────
            scale_subfactor, created_ss = Scale.objects.update_or_create(
                name="Subfactor",
                defaults={
                    "description": "Valoración de subfactor elegida por el decisor (1: No cumple, 2: Desconozco, 3: Cumple parcialmente, 4: Cumple)",
                    "is_active": True,
                },
            )
            action_ss = "Creada" if created_ss else "Actualizada"
            self.stdout.write(f"• Escala '{scale_subfactor.name}': {action_ss} (ID: {scale_subfactor.id})")

            subfactor_levels = [
                (1, "No cumple el requisito", 1),
                (2, "Desconozco si cumple el requisito", 2),
                (3, "Cumple parcialmente el requisito", 3),
                (4, "Cumple el requisito", 4),
            ]

            for val, label, order in subfactor_levels:
                lvl_obj, created_lvl = ScaleLevel.objects.update_or_create(
                    scale=scale_subfactor,
                    label=label,
                    defaults={
                        "value": val,
                        "order": order,
                        "is_active": True,
                    },
                )
                act = "Creado" if created_lvl else "Actualizado"
                self.stdout.write(f"   ↳ [ScaleLevel Subfactor] {val} - {label} ({act})")

            # ─────────────────────────────────────────────────────────────
            # 3. ALCANCES (en tabla Scope)
            # ─────────────────────────────────────────────────────────────
            scopes_def = [
                ("Interno", "Alcance interno del factor dentro de la organización"),
                ("Externo", "Alcance externo del factor en el mercado o entorno del software"),
            ]

            for name, desc in scopes_def:
                scope_obj, created_sc = Scope.objects.update_or_create(
                    name=name,
                    defaults={
                        "description": desc,
                        "is_active": True,
                    },
                )
                act = "Creado" if created_sc else "Actualizado"
                self.stdout.write(f"• Scope '{scope_obj.name}': {act} (ID: {scope_obj.id})")

        self.stdout.write(self.style.SUCCESS("\n" + "=" * 65))
        self.stdout.write(self.style.SUCCESS("  ESCALAS, NIVELES Y ALCANCES CONFIGURADOS CON ÉXITO"))
        self.stdout.write(self.style.SUCCESS("=" * 65))
        self.stdout.write(f"  • Escalas (Scale):           {Scale.objects.count()}")
        self.stdout.write(f"  • Niveles (ScaleLevel):      {ScaleLevel.objects.count()}")
        self.stdout.write(f"  • Alcances (Scope):          {Scope.objects.count()}")
        self.stdout.write(self.style.SUCCESS("=" * 65 + "\n"))
