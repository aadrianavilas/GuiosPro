from django.test import TestCase
from django.contrib.auth.models import Group
from rest_framework.test import APIClient
from rest_framework import status

from apps.auth.models.auth.user import User


class UserManagementAPITestCase(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin_group = Group.objects.create(name="Administrador")
        self.decisor_group = Group.objects.create(name="Decisor")

        self.admin = User.objects.create_superuser(
            username="adminuser",
            email="admin@guiospro.local",
            first_name="Carlos",
            last_name="Mendoza",
            password="SecureAdminPassword2026!",
        )
        self.admin.groups.add(self.admin_group)
        self.client.force_authenticate(user=self.admin)

    def test_list_users(self):
        response = self.client.get("/api/v1/config/users/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(len(response.data) >= 1)

    def test_create_user_success(self):
        payload = {
            "first_name": "Valeria",
            "last_name": "Rios",
            "username": "vrios",
            "email": "valeria.rios@guiospro.local",
            "password": "TemporalComplexPassword2026#",
            "confirm_password": "TemporalComplexPassword2026#",
            "group_ids": [self.decisor_group.id],
        }
        response = self.client.post("/api/v1/config/users/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data["username"], "vrios")
        self.assertEqual(len(response.data["groups"]), 1)
        self.assertEqual(response.data["groups"][0]["name"], "Decisor")

    def test_create_user_password_too_short(self):
        payload = {
            "first_name": "Lucas",
            "last_name": "Perez",
            "username": "lperez",
            "email": "lucas@guiospro.local",
            "password": "Short1!",
            "confirm_password": "Short1!",
            "group_ids": [],
        }
        response = self.client.post("/api/v1/config/users/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_create_user_password_all_digits(self):
        payload = {
            "first_name": "Lucas",
            "last_name": "Perez",
            "username": "lperez",
            "email": "lucas@guiospro.local",
            "password": "123456789012",
            "confirm_password": "123456789012",
            "group_ids": [],
        }
        response = self.client.post("/api/v1/config/users/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_create_user_password_contains_personal_info(self):
        payload = {
            "first_name": "Fernando",
            "last_name": "Gomez",
            "username": "fgomez",
            "email": "fgomez@guiospro.local",
            "password": "ClaveFernando2026!",
            "confirm_password": "ClaveFernando2026!",
            "group_ids": [],
        }
        response = self.client.post("/api/v1/config/users/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("password", response.data)

    def test_update_user_without_password(self):
        user = User.objects.create_user(
            username="maria",
            email="maria@guiospro.local",
            first_name="Maria",
            last_name="Lopez",
            password="InitialSecretPassword2026!",
        )
        old_password_hash = user.password

        payload = {
            "first_name": "Maria Elena",
            "last_name": "Lopez Silva",
            "group_ids": [self.admin_group.id, self.decisor_group.id],
        }
        response = self.client.put(f"/api/v1/config/users/{user.id}/", payload, format="json")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertEqual(user.first_name, "Maria Elena")
        self.assertEqual(user.last_name, "Lopez Silva")
        self.assertEqual(user.password, old_password_hash)  # Password cannot be changed here
        self.assertEqual(user.groups.count(), 2)

    def test_toggle_active_status(self):
        user = User.objects.create_user(
            username="roberto",
            email="roberto@guiospro.local",
            first_name="Roberto",
            last_name="Diaz",
            password="InitialSecretPassword2026!",
            is_active=True,
        )
        response = self.client.post(f"/api/v1/config/users/{user.id}/toggle-active/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

        response = self.client.post(f"/api/v1/config/users/{user.id}/toggle-active/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        user.refresh_from_db()
        self.assertTrue(user.is_active)

    def test_admin_cannot_deactivate_self(self):
        response = self.client.post(f"/api/v1/config/users/{self.admin.id}/toggle-active/")
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("no puede desactivar su propia cuenta", response.data["detail"])

    def test_token_refresh_and_logout(self):
        from apps.auth.services.auth import TokenService
        tokens = TokenService.generate_auth_tokens(self.admin)
        refresh_str = str(tokens["refresh_token"])

        # Probar renovación
        refresh_response = self.client.post("/api/v1/auth/token/refresh/", {"refresh": refresh_str}, format="json")
        self.assertEqual(refresh_response.status_code, status.HTTP_200_OK)
        self.assertIn("access", refresh_response.data)

        # Probar logout
        logout_response = self.client.post("/api/v1/auth/logout/", {"refresh": refresh_str}, format="json")
        self.assertEqual(logout_response.status_code, status.HTTP_200_OK)

    def test_password_reset_request_generic_response(self):
        # Para correo existente
        res_exist = self.client.post(
            "/api/v1/auth/password-reset/request/",
            {"email": "admin@guiospro.local"},
            format="json",
        )
        self.assertEqual(res_exist.status_code, status.HTTP_200_OK)
        self.assertIn("Si el correo está registrado", res_exist.data["detail"])

        # Para correo inexistente: debe responder exactamente con el mismo mensaje genérico
        res_non_exist = self.client.post(
            "/api/v1/auth/password-reset/request/",
            {"email": "inexistente@dominiofalso.com"},
            format="json",
        )
        self.assertEqual(res_non_exist.status_code, status.HTTP_200_OK)
        self.assertEqual(res_exist.data["detail"], res_non_exist.data["detail"])

    def test_password_reset_flow_success(self):
        from django.core.cache import cache
        email = "admin@guiospro.local"

        # 1. Solicitar código
        req_res = self.client.post(
            "/api/v1/auth/password-reset/request/",
            {"email": email},
            format="json",
        )
        self.assertEqual(req_res.status_code, status.HTTP_200_OK)

        # 2. Obtener código de caché
        cache_data = cache.get(f"guios_pwd_reset_{email}")
        self.assertIsNotNone(cache_data)
        code = cache_data["code"]

        # 3. Verificar código
        verify_res = self.client.post(
            "/api/v1/auth/password-reset/verify/",
            {"email": email, "code": code},
            format="json",
        )
        self.assertEqual(verify_res.status_code, status.HTTP_200_OK)
        reset_token = verify_res.data["reset_token"]

        # 4. Confirmar nueva contraseña segura
        new_pwd = "NuevaClaveSuperSegura2026#"
        confirm_res = self.client.post(
            "/api/v1/auth/password-reset/confirm/",
            {
                "reset_token": reset_token,
                "password": new_pwd,
                "confirm_password": new_pwd,
            },
            format="json",
        )
        self.assertEqual(confirm_res.status_code, status.HTTP_200_OK)

        # 5. Comprobar que la nueva contraseña funciona
        self.admin.refresh_from_db()
        self.assertTrue(self.admin.check_password(new_pwd))
