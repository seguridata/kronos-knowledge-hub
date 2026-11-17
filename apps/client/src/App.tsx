import { lazy, Suspense } from "react";
import PageLoading from "@/components/ui/page-loading";
import { Navigate, Route, Routes } from "react-router-dom";

import { Error404 } from "@/components/ui/error-404.tsx";

import { isCloud } from "@/lib/config.ts";
import { useTranslation } from "react-i18next";
import { useRedirectToCloudSelect } from "@/ee/hooks/use-redirect-to-cloud-select.tsx";

import { useTrackOrigin } from "@/hooks/use-track-origin";

import { MfaChallengePage } from "@/ee/mfa/pages/mfa-challenge-page";
import { MfaSetupRequiredPage } from "@/ee/mfa/pages/mfa-setup-required-page";

const SetupWorkspace = lazy(() => import("@/pages/auth/setup-workspace.tsx"));
const PdfRenderPage = lazy(() => import("@/ee/pdf-export/pdf-render-page.tsx"));
const LoginPage = lazy(() => import("@/pages/auth/login"));
const Home = lazy(() => import("@/pages/dashboard/home"));
const Page = lazy(() => import("@/pages/page/page"));
const AccountSettings = lazy(
  () => import("@/pages/settings/account/account-settings"),
);
const WorkspaceMembers = lazy(
  () => import("@/pages/settings/workspace/workspace-members"),
);
const WorkspaceSettings = lazy(
  () => import("@/pages/settings/workspace/workspace-settings"),
);
const Groups = lazy(() => import("@/pages/settings/group/groups"));
const GroupInfo = lazy(() => import("./pages/settings/group/group-info"));
const Spaces = lazy(() => import("@/pages/settings/space/spaces.tsx"));
const AccountPreferences = lazy(
  () => import("@/pages/settings/account/account-preferences.tsx"),
);
const SpaceHome = lazy(() => import("@/pages/space/space-home.tsx"));
const PageRedirect = lazy(() => import("@/pages/page/page-redirect.tsx"));
const Layout = lazy(() => import("@/components/layouts/global/layout.tsx"));
const InviteSignup = lazy(() => import("@/pages/auth/invite-signup.tsx"));
const ForgotPassword = lazy(() => import("@/pages/auth/forgot-password.tsx"));
const PasswordReset = lazy(() => import("./pages/auth/password-reset"));
const CloudLogin = lazy(() => import("@/ee/pages/cloud-login.tsx"));
const CreateWorkspace = lazy(() => import("@/ee/pages/create-workspace.tsx"));
const SharedPage = lazy(() => import("@/pages/share/shared-page.tsx"));
const Shares = lazy(() => import("@/pages/settings/shares/shares.tsx"));
const ShareLayout = lazy(
  () => import("@/features/share/components/share-layout.tsx"),
);
const ShareRedirect = lazy(() => import("@/pages/share/share-redirect.tsx"));
const SpacesPage = lazy(() => import("@/pages/spaces/spaces.tsx"));
const SpaceTrash = lazy(() => import("@/pages/space/space-trash.tsx"));
const BasePage = lazy(() => import("@/ee/base/pages/base-page.tsx"));
const AuditLogs = lazy(() => import("@/kronos/audit/pages/audit-logs.tsx"));
const FavoritesPage = lazy(() => import("@/pages/favorites/favorites-page"));
const AiChat = lazy(() => import("@/ee/ai-chat/pages/ai-chat.tsx"));
const VerifyEmail = lazy(() => import("@/ee/pages/verify-email.tsx"));
const LabelPage = lazy(() => import("@/pages/label/label-page"));

export default function App() {
  const { t } = useTranslation();
  useRedirectToCloudSelect();
  useTrackOrigin();

  return (
    <>
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route index element={<Navigate to="/home" />} />
          <Route path={"/login"} element={<LoginPage />} />
          <Route path={"/invites/:invitationId"} element={<InviteSignup />} />
          <Route path={"/forgot-password"} element={<ForgotPassword />} />
          <Route path={"/password-reset"} element={<PasswordReset />} />
          <Route path={"/login/mfa"} element={<MfaChallengePage />} />
          <Route path={"/login/mfa/setup"} element={<MfaSetupRequiredPage />} />

          {!isCloud() && (
            <Route path={"/setup/register"} element={<SetupWorkspace />} />
          )}

          {isCloud() && (
            <>
              <Route path={"/create"} element={<CreateWorkspace />} />
              <Route path={"/select"} element={<CloudLogin />} />
              <Route path={"/verify-email"} element={<VerifyEmail />} />
            </>
          )}

          <Route element={<ShareLayout />}>
            <Route
              path={"/share/:shareId/p/:pageSlug"}
              element={<SharedPage />}
            />
            <Route path={"/share/p/:pageSlug"} element={<SharedPage />} />
          </Route>

          <Route path={"/pdf-render/:pageId"} element={<PdfRenderPage />} />
          <Route path={"/share/:shareId"} element={<ShareRedirect />} />
          <Route path={"/p/:pageSlug"} element={<PageRedirect />} />

          <Route element={<Layout />}>
            <Route path={"/home"} element={<Home />} />
            <Route path={"/ai"} element={<AiChat />} />
            <Route path={"/ai/chat/:chatId"} element={<AiChat />} />
            <Route path={"/spaces"} element={<SpacesPage />} />
            <Route path={"/favorites"} element={<FavoritesPage />} />
            <Route path={"/labels/:labelName"} element={<LabelPage />} />
            <Route path={"/s/:spaceSlug"} element={<SpaceHome />} />
            <Route path={"/s/:spaceSlug/trash"} element={<SpaceTrash />} />
            <Route path={"/s/:spaceSlug/p/:pageSlug"} element={<Page />} />

            <Route path={"/base/:pageId"} element={<BasePage />} />

            <Route path={"/settings"}>
              <Route path={"account/profile"} element={<AccountSettings />} />
              <Route
                path={"account/preferences"}
                element={<AccountPreferences />}
              />
              <Route path={"workspace"} element={<WorkspaceSettings />} />
              <Route path={"members"} element={<WorkspaceMembers />} />
              <Route path={"groups"} element={<Groups />} />
              <Route path={"groups/:groupId"} element={<GroupInfo />} />
              <Route path={"spaces"} element={<Spaces />} />
              <Route path={"sharing"} element={<Shares />} />
              <Route path={"audit"} element={<AuditLogs />} />
            </Route>
          </Route>

          <Route path="*" element={<Error404 />} />
        </Routes>
      </Suspense>
    </>
  );
}
