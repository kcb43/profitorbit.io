import React from "react";

// Route-level code splitting: keep initial bundle small (Landing/Login/Signup)
const Layout = React.lazy(() => import("./Layout.jsx"));

const Dashboard = React.lazy(() => import("./Dashboard"));
const Landing = React.lazy(() => import("./Landing"));
const Login = React.lazy(() => import("./Login"));
const SignUp = React.lazy(() => import("./SignUp"));
const ProfileSettings = React.lazy(() => import("./ProfileSettings"));

const AddSale = React.lazy(() => import("./AddSale"));
const SalesHistory = React.lazy(() => import("./SalesHistory"));

const Inventory = React.lazy(() => import("./Inventory"));
const AddInventoryItem = React.lazy(() => import("./AddInventoryItem"));

const Reports = React.lazy(() => import("./Reports"));
const PlatformPerformance = React.lazy(() => import("./PlatformPerformance"));
const Gallery = React.lazy(() => import("./Gallery"));
const SoldItemDetail = React.lazy(() => import("./SoldItemDetail"));
const ProfitCalendar = React.lazy(() => import("./ProfitCalendar"));

const Crosslist = React.lazy(() => import("./Crosslist"));
const CrosslistComposer = React.lazy(() => import("./CrosslistComposer"));
const Crosslisting = React.lazy(() => import("./Crosslisting"));
const Import = React.lazy(() => import("./Import"));
const MarketIntelligence = React.lazy(() => import("./MarketIntelligence"));
const MarketIntelligenceDetail = React.lazy(() => import("./MarketIntelligenceDetail"));
const Pulse = React.lazy(() => import("./Pulse"));
const Settings = React.lazy(() => import("./Settings"));
const Tools = React.lazy(() => import("./Tools"));
const Analytics = React.lazy(() => import("./Analytics"));
const ProTools = React.lazy(() => import("./ProTools"));
const ProToolsSendOffers = React.lazy(() => import("./ProToolsSendOffers"));
const ProToolsAutoOffers = React.lazy(() => import("./ProToolsAutoOffers"));
const ProToolsMarketplaceSharing = React.lazy(() => import("./ProToolsMarketplaceSharing"));
const Rewards = React.lazy(() => import("./Rewards"));
const PrivacyPolicy = React.lazy(() => import("./PrivacyPolicy"));
const FAQ = React.lazy(() => import("./FAQ"));
const MigrateData = React.lazy(() => import("./MigrateData"));

const EbayOauthLanding = React.lazy(() => import("./EbayOauthLanding"));
import DevErrorBoundary from "../components/DevErrorBoundary";
import ScrollToTop from "../components/ScrollToTop";
import { AuthGuard } from "../components/AuthGuard";
import { AdminGuard } from "../components/AdminGuard";

import { BrowserRouter as Router, Route, Routes, useLocation, Navigate } from 'react-router-dom';

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
        <p className="mt-4 text-gray-600">Loading...</p>
      </div>
    </div>
  );
}

function withSuspense(element) {
  return <React.Suspense fallback={<PageLoader />}>{element}</React.Suspense>;
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    return (
        <>
            <ScrollToTop />
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={withSuspense(<Landing />)} />
              
              {/* Login Page */}
              <Route path="/login" element={withSuspense(<Login />)} />
              
              {/* Sign Up Page */}
              <Route path="/signup" element={withSuspense(<SignUp />)} />
              
              {/* Protected Dashboard Routes */}
              <Route
                path="/dashboard"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Dashboard">
                        {withSuspense(<Dashboard />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              <Route
                path="/Dashboard"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Dashboard">
                        {withSuspense(<Dashboard />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              {/* Profile Settings */}
              <Route
                path="/ProfileSettings"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="ProfileSettings">
                        {withSuspense(<ProfileSettings />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              {/* Other Protected Routes */}
              <Route
                path="/AddSale"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="AddSale">
                        {withSuspense(<AddSale />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/SalesHistory"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="SalesHistory">
                        {withSuspense(<SalesHistory />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Inventory"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Inventory">
                        {import.meta.env.DEV ? (
                          <DevErrorBoundary>
                            {withSuspense(<Inventory />)}
                          </DevErrorBoundary>
                        ) : (
                          withSuspense(<Inventory />)
                        )}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/AddInventoryItem"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="AddInventoryItem">
                        {withSuspense(<AddInventoryItem />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Reports"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Reports">
                        {withSuspense(<Reports />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/platformperformance"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="PlatformPerformance">
                        {withSuspense(<PlatformPerformance />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Gallery"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Gallery">
                        {withSuspense(<Gallery />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/SoldItemDetail"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="SoldItemDetail">
                        {withSuspense(<SoldItemDetail />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/ProfitCalendar"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="ProfitCalendar">
                        {withSuspense(<ProfitCalendar />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Crosslist"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Crosslist">
                        {withSuspense(<Crosslist />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/CrosslistComposer"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="CrosslistComposer">
                        {withSuspense(<CrosslistComposer />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Import"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Import">
                        {withSuspense(<Import />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/crosslisting"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Crosslisting">
                        {withSuspense(<Crosslisting />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              <Route
                path="/Crosslisting"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Crosslisting">
                        {withSuspense(<Crosslisting />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/pulse/:marketplaceId"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Pulse">
                        {withSuspense(<MarketIntelligenceDetail />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
              
              <Route
                path="/Settings"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Settings">
                        {withSuspense(<Settings />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/Tools"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Tools">
                        {withSuspense(<Tools />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/Pulse"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Pulse">
                        {withSuspense(<Pulse />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/pro-tools"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Pro Tools">
                        {withSuspense(<ProTools />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/pro-tools/send-offers"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Send Offers">
                        {withSuspense(<ProToolsSendOffers />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/pro-tools/auto-offers"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Auto Offers">
                        {withSuspense(<ProToolsAutoOffers />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/pro-tools/marketplace-sharing"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Marketplace Sharing">
                        {withSuspense(<ProToolsMarketplaceSharing />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/Analytics"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Analytics">
                        {withSuspense(<Analytics />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />

              <Route
                path="/MigrateData"
                element={
                  <AuthGuard>
                    <AdminGuard>
                      {withSuspense(
                        <Layout currentPageName="Settings">
                          {withSuspense(<MigrateData />)}
                        </Layout>
                      )}
                    </AdminGuard>
                  </AuthGuard>
                }
              />
              
              {/* Public Routes */}
              <Route path="/oauth/ebay" element={withSuspense(<EbayOauthLanding />)} />
              <Route path="/PrivacyPolicy" element={withSuspense(<PrivacyPolicy />)} />
              <Route path="/FAQ" element={withSuspense(<FAQ />)} />
              <Route
                path="/Rewards"
                element={
                  <AuthGuard>
                    {withSuspense(
                      <Layout currentPageName="Rewards">
                        {withSuspense(<Rewards />)}
                      </Layout>
                    )}
                  </AuthGuard>
                }
              />
            </Routes>
        </>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}