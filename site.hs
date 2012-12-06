{-# LANGUAGE OverloadedStrings #-}

import Control.Arrow
import Control.Category
import Control.Monad
import Data.Maybe
import Hakyll
import Prelude hiding (id)

main :: IO ()
main = hakyll $ do
   
   match "templates/*" $ compile templateCompiler

   match "experiments/**" $ do
      route idRoute
      compile copyFileCompiler
   
   match (list ["index.md", "experiments/index.md"]) $ do
      route   $ setExtension "html"
      compile $ pageCompiler
         >>> applyTemplateCompiler "templates/default.html"
         >>> relativizeUrlsCompiler
         
   
