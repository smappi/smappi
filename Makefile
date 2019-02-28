all: publish

publish:
	@npm version ${VERSION}
	@git push origin master --tags
	@git push mirror master --tags
	@npm publish
